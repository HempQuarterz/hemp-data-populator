import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { logger } from '../utils/logger';
import { config } from '../config';
import { DataSource, ScrapeResult, HempProduct } from '../types';
import { sleep } from '../utils/helpers';

export class Scraper {
  private limit = pLimit(config.scraping.maxConcurrentRequests);
  
  async scrape(source: DataSource): Promise<ScrapeResult> {
    logger.info(`Scraping ${source.type} from ${source.url}`);
    
    const startTime = Date.now();
    const result: ScrapeResult = {
      products: [],
      source: source.url,
      scraped_at: new Date(),
      total_found: 0,
      errors: []
    };
    
    try {
      switch (source.type) {
        case 'html':
          result.products = await this.scrapeHTML(source.url);
          break;
        case 'csv':
          result.products = await this.scrapeCSV(source.url);
          break;
        case 'json':
          result.products = await this.scrapeJSON(source.url);
          break;
        case 'pdf':
          result.products = await this.scrapePDF(source.url);
          break;
        default:
          throw new Error(`Unsupported source type: ${source.type}`);
      }
      
      result.total_found = result.products.length;
      logger.info(`Scraped ${result.total_found} products in ${Date.now() - startTime}ms`);
      
    } catch (error) {
      const errorMsg = `Scraping failed: ${error}`;
      logger.error(errorMsg);
      result.errors?.push(errorMsg);
    }
    
    return result;
  }
  
  private async scrapeHTML(url: string): Promise<HempProduct[]> {
    const response = await axios.get(url, {
      headers: { 'User-Agent': config.scraping.userAgent },
      timeout: config.scraping.timeout
    });
    
    const $ = cheerio.load(response.data);
    const products: HempProduct[] = [];
    
    // Look for common patterns in HTML
    // This is a simplified example - real implementation would be more sophisticated
    
    // Pattern 1: Lists of hemp uses
    $('li').each((_, elem) => {
      const text = $(elem).text().trim();
      if (this.isHempProduct(text)) {
        const product = this.parseTextToProduct(text, url);
        if (product) products.push(product);
      }
    });
    
    // Pattern 2: Tables with hemp products
    $('table tr').each((_, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 2) {
        const name = cells.eq(0).text().trim();
        const description = cells.eq(1).text().trim();
        
        if (this.isHempProduct(name) || this.isHempProduct(description)) {
          products.push({
            product_name: name,
            description: description,
            plant_part: this.extractPlantPart(name + ' ' + description),
            industry: this.extractIndustry(name + ' ' + description),
            source_url: url
          });
        }
      }
    });
    
    // Pattern 3: Definition lists
    $('dl').each((_, dl) => {
      $(dl).find('dt').each((i, dt) => {
        const term = $(dt).text().trim();
        const definition = $(dt).next('dd').text().trim();
        
        if (this.isHempProduct(term) || this.isHempProduct(definition)) {
          products.push({
            product_name: term,
            description: definition,
            plant_part: this.extractPlantPart(term + ' ' + definition),
            industry: this.extractIndustry(term + ' ' + definition),
            source_url: url
          });
        }
      });
    });
    
    await sleep(config.scraping.rateLimitDelayMs);
    return products;
  }
  
  private async scrapeCSV(url: string): Promise<HempProduct[]> {
    let data: string;
    
    // Handle local file URLs
    if (url.startsWith('file://')) {
      try {
        const fs = await import('fs/promises');
        const filePath = url.replace('file://', '');
        data = await fs.readFile(filePath, 'utf-8');
        logger.info('Reading local CSV file:', filePath);
      } catch (error) {
        logger.error('Failed to read local file:', error);
        throw error;
      }
    } else {
      // Handle remote URLs
      const response = await axios.get(url, {
        headers: { 'User-Agent': config.scraping.userAgent },
        timeout: config.scraping.timeout
      });
      data = response.data;
    }
    
    const lines = data.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      logger.warn('CSV file has no data rows');
      return [];
    }
    
    // Parse CSV properly (handling quoted fields)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            // Escaped quote
            current += '"';
            i++; // Skip next quote
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          // End of field
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      // Don't forget the last field
      result.push(current.trim());
      return result;
    };
    
    const headers = parseCSVLine(lines[0].toLowerCase());
    const products: HempProduct[] = [];
    
    // Find relevant column indices
    const nameIdx = headers.findIndex((h: string) => h.includes('product') || h.includes('name'));
    const descIdx = headers.findIndex((h: string) => h.includes('description') || h.includes('use'));
    const partIdx = headers.findIndex((h: string) => h.includes('part') || h.includes('component'));
    const industryIdx = headers.findIndex((h: string) => h.includes('industry') || h.includes('sector'));
    const benefitsIdx = headers.findIndex((h: string) => h.includes('benefit'));
    const sourceIdx = headers.findIndex((h: string) => h.includes('source') || h.includes('url'));
    
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      
      if (cells.length > nameIdx && nameIdx >= 0 && cells[nameIdx]) {
        const product: HempProduct = {
          product_name: cells[nameIdx] || 'Unknown',
          description: (descIdx >= 0 ? cells[descIdx] : '') || '',
          plant_part: (partIdx >= 0 ? cells[partIdx] : '') || this.extractPlantPart(lines[i]),
          industry: (industryIdx >= 0 ? cells[industryIdx] : '') || this.extractIndustry(lines[i]),
          source_url: (sourceIdx >= 0 ? cells[sourceIdx] : '') || url
        };
        
        // Add benefits if available
        if (benefitsIdx >= 0 && cells[benefitsIdx]) {
          product.benefits = cells[benefitsIdx].split(',').map(b => b.trim()).filter(b => b);
        }
        
        products.push(product);
      }
    }
    
    await sleep(config.scraping.rateLimitDelayMs);
    return products;
  }
  
  private async scrapeJSON(url: string): Promise<HempProduct[]> {
    const response = await axios.get(url, {
      headers: { 'User-Agent': config.scraping.userAgent },
      timeout: config.scraping.timeout
    });
    
    const data = response.data;
    const products: HempProduct[] = [];
    
    // Handle different JSON structures
    if (Array.isArray(data)) {
      for (const item of data) {
        const product = this.parseJSONItem(item, url);
        if (product) products.push(product);
      }
    } else if (typeof data === 'object') {
      // Look for arrays within the object
      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          for (const item of data[key]) {
            const product = this.parseJSONItem(item, url);
            if (product) products.push(product);
          }
        }
      }
    }
    
    await sleep(config.scraping.rateLimitDelayMs);
    return products;
  }
  
  private async scrapePDF(url: string): Promise<HempProduct[]> {
    // PDF scraping would require pdf-parse or calling a Python script
    // For now, we'll return empty array
    logger.warn('PDF scraping not implemented yet');
    return [];
  }
  
  private parseJSONItem(item: any, sourceUrl: string): HempProduct | null {
    if (!item || typeof item !== 'object') return null;
    
    // Try to find relevant fields
    const name = item.product || item.name || item.title || item.item;
    const description = item.description || item.details || item.use || '';
    
    if (!name) return null;
    
    return {
      product_name: String(name),
      description: String(description),
      plant_part: item.plant_part || item.part || this.extractPlantPart(name + ' ' + description),
      industry: item.industry || item.sector || this.extractIndustry(name + ' ' + description),
      source_url: sourceUrl,
      benefits: item.benefits || item.advantages,
      technical_specs: item.specifications || item.specs,
      keywords: item.keywords || item.tags
    };
  }
  
  private parseTextToProduct(text: string, sourceUrl: string): HempProduct | null {
    // Simple heuristic parsing
    const parts = text.split(/[-:–—]/);
    const name = parts[0]?.trim();
    const description = parts.slice(1).join(' ').trim();
    
    if (!name || name.length < 3) return null;
    
    return {
      product_name: name,
      description: description || name,
      plant_part: this.extractPlantPart(text),
      industry: this.extractIndustry(text),
      source_url: sourceUrl
    };
  }
  
  private isHempProduct(text: string): boolean {
    const keywords = ['hemp', 'fiber', 'seed', 'oil', 'cbd', 'cannabinoid', 'industrial'];
    const lower = text.toLowerCase();
    return keywords.some(keyword => lower.includes(keyword));
  }
  
  private extractPlantPart(text: string): string {
    const lower = text.toLowerCase();
    
    if (lower.includes('seed')) return 'seed';
    if (lower.includes('fiber') || lower.includes('fibre')) return 'fiber';
    if (lower.includes('flower') || lower.includes('bud')) return 'flower';
    if (lower.includes('leaf') || lower.includes('leaves')) return 'leaf';
    if (lower.includes('root')) return 'root';
    if (lower.includes('stem') || lower.includes('stalk')) return 'stem';
    if (lower.includes('oil')) return 'seed'; // Hemp oil typically from seeds
    if (lower.includes('whole plant')) return 'whole plant';
    
    return 'unspecified';
  }
  
  private extractIndustry(text: string): string {
    const lower = text.toLowerCase();
    
    if (lower.includes('food') || lower.includes('nutrition')) return 'Food & Nutrition';
    if (lower.includes('textile') || lower.includes('fabric') || lower.includes('clothing')) return 'Textiles';
    if (lower.includes('construction') || lower.includes('building')) return 'Construction';
    if (lower.includes('automotive') || lower.includes('car')) return 'Automotive';
    if (lower.includes('cosmetic') || lower.includes('beauty')) return 'Cosmetics';
    if (lower.includes('pharmaceutical') || lower.includes('medicine')) return 'Pharmaceutical';
    if (lower.includes('paper') || lower.includes('pulp')) return 'Paper';
    if (lower.includes('plastic') || lower.includes('bioplastic')) return 'Bioplastics';
    if (lower.includes('energy') || lower.includes('fuel')) return 'Energy';
    
    return 'Other';
  }
}