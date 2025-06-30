import crypto from 'crypto';
import { logger } from '../utils/logger';
import { HempProduct } from '../types';

interface ProcessResult {
  unique: HempProduct[];
  duplicates: number;
}

interface Company {
  name: string;
  website?: string;
  description?: string;
  primary_focus?: string;
}

export class DataProcessor {
  private seenHashes = new Set<string>();
  
  async process(products: HempProduct[]): Promise<ProcessResult> {
    logger.info(`Processing ${products.length} products...`);
    
    const unique: HempProduct[] = [];
    let duplicates = 0;
    let invalid = 0;
    
    for (const product of products) {
      // Validate product data first
      if (!this.isValidProduct(product)) {
        invalid++;
        continue;
      }
      
      // Clean and normalize the product data
      const cleaned = this.cleanProduct(product);
      
      // Generate hash for deduplication
      const hash = this.generateHash(cleaned);
      
      if (!this.seenHashes.has(hash)) {
        this.seenHashes.add(hash);
        
        // Enrich the product data
        const enriched = await this.enrichProduct(cleaned);
        unique.push(enriched);
      } else {
        duplicates++;
      }
    }
    
    logger.info(`Processed: ${unique.length} unique, ${duplicates} duplicates, ${invalid} invalid`);
    return { unique, duplicates };
  }
  
  private isValidProduct(product: HempProduct): boolean {
    // Check if product name is just a number
    if (/^\d+$/.test(product.product_name)) {
      logger.warn(`Invalid product: numeric name "${product.product_name}"`);
      return false;
    }
    
    // Check if plant part is just a number
    if (/^\d+$/.test(product.plant_part)) {
      logger.warn(`Invalid product: numeric plant_part "${product.plant_part}" for "${product.product_name}"`);
      return false;
    }
    
    // Check for minimum data quality
    if (!product.product_name || product.product_name.length < 3) {
      logger.warn(`Invalid product: name too short "${product.product_name}"`);
      return false;
    }
    
    // Check if description is empty and product name is generic
    if ((!product.description || product.description.trim() === '') && 
        product.product_name.length < 5) {
      logger.warn(`Invalid product: insufficient data for "${product.product_name}"`);
      return false;
    }
    
    // Additional validation rules
    
    // Must contain "hemp" or "cannabis" in name or description
    const lowerName = product.product_name.toLowerCase();
    const lowerDesc = (product.description || '').toLowerCase();
    if (!lowerName.includes('hemp') && !lowerName.includes('cannabis') && 
        !lowerName.includes('cbd') && !lowerDesc.includes('hemp')) {
      logger.warn(`Invalid product: not hemp-related "${product.product_name}"`);
      return false;
    }
    
    // Industry must be meaningful (not "Other" or numeric)
    if (!product.industry || product.industry === 'Other' || /^\d+$/.test(product.industry)) {
      logger.warn(`Invalid product: bad industry "${product.industry}" for "${product.product_name}"`);
      return false;
    }
    
    // Plant part must be from allowed list
    const validPlantParts = [
      'seed', 'seeds', 'fiber', 'fibre', 'flower', 'leaves', 'leaf', 
      'stem', 'stalk', 'hurds', 'hurd', 'roots', 'root', 'oil', 
      'whole plant', 'biomass', 'sprouts', 'extract'
    ];
    
    const plantPartLower = product.plant_part.toLowerCase();
    const isValidPlantPart = validPlantParts.some(part => 
      plantPartLower.includes(part) || part.includes(plantPartLower)
    );
    
    if (!isValidPlantPart) {
      logger.warn(`Invalid product: unknown plant_part "${product.plant_part}" for "${product.product_name}"`);
      return false;
    }
    
    // Check for suspicious patterns
    if (product.source_url && product.source_url.includes('gist.github')) {
      logger.warn(`Suspicious source: GitHub gist for "${product.product_name}"`);
      // Extra scrutiny for GitHub gists
      if (!product.description || product.description.length < 20) {
        return false;
      }
    }
    
    return true;
  }
  
  private cleanProduct(product: HempProduct): HempProduct {
    return {
      product_name: this.cleanText(product.product_name),
      plant_part: this.normalizeText(product.plant_part),
      industry: this.normalizeText(product.industry),
      description: this.cleanText(product.description),
      source_url: product.source_url,
      benefits: product.benefits?.map(b => this.cleanText(b)),
      technical_specs: product.technical_specs,
      sustainability_aspects: product.sustainability_aspects?.map(s => this.cleanText(s)),
      keywords: this.extractKeywords(product)
    };
  }
  
  private cleanText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .replace(/^[\s\-•–—]+/, '') // Remove leading bullets/dashes
      .trim();
  }
  
  private normalizeText(text: string): string {
    return this.cleanText(text)
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  
  private generateHash(product: HempProduct): string {
    const key = `${product.product_name}|${product.plant_part}|${product.industry}`
      .toLowerCase()
      .replace(/\s+/g, '');
    
    return crypto
      .createHash('sha256')
      .update(key)
      .digest('hex');
  }
  
  private async enrichProduct(product: HempProduct): Promise<HempProduct> {
    // Extract additional data from description
    const enriched = { ...product };
    
    // Extract benefits if not already present
    if (!enriched.benefits || enriched.benefits.length === 0) {
      enriched.benefits = this.extractBenefits(product.description);
    }
    
    // Extract sustainability aspects
    if (!enriched.sustainability_aspects || enriched.sustainability_aspects.length === 0) {
      enriched.sustainability_aspects = this.extractSustainability(product.description);
    }
    
    // Add keywords
    enriched.keywords = this.extractKeywords(product);
    
    return enriched;
  }
  
  private extractBenefits(text: string): string[] {
    const benefits: string[] = [];
    const benefitPatterns = [
      /(?:benefits?|advantages?)\s*:?\s*([^.;]+)/gi,
      /(?:helps?|provides?|offers?)\s+([^.;]+)/gi,
      /(?:reduces?|improves?|increases?)\s+([^.;]+)/gi
    ];
    
    for (const pattern of benefitPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          benefits.push(this.cleanText(match[1]));
        }
      }
    }
    
    return [...new Set(benefits)]; // Remove duplicates
  }
  
  private extractSustainability(text: string): string[] {
    const aspects: string[] = [];
    const sustainKeywords = [
      'sustainable', 'renewable', 'biodegradable', 'eco-friendly',
      'carbon negative', 'recyclable', 'compostable', 'organic',
      'low impact', 'green', 'environmental'
    ];
    
    const lower = text.toLowerCase();
    for (const keyword of sustainKeywords) {
      if (lower.includes(keyword)) {
        // Find the sentence containing this keyword
        const sentences = text.split(/[.!?]+/);
        for (const sentence of sentences) {
          if (sentence.toLowerCase().includes(keyword)) {
            aspects.push(this.cleanText(sentence));
            break;
          }
        }
      }
    }
    
    return [...new Set(aspects)];
  }
  
  private extractKeywords(product: HempProduct): string[] {
    const text = `${product.product_name} ${product.description} ${product.plant_part} ${product.industry}`;
    const words = text.toLowerCase().split(/\W+/);
    
    // Common words to exclude
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'cannot'
    ]);
    
    // Extract meaningful keywords
    const keywords = words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .filter((word, index, self) => self.indexOf(word) === index); // Unique only
    
    return keywords.slice(0, 20); // Limit to 20 keywords
  }
  
  async extractCompanies(products: HempProduct[]): Promise<Company[]> {
    const companies: Company[] = [];
    const companyPatterns = [
      /(?:manufactured by|produced by|made by|from)\s+([A-Z][\w\s&-]+)/gi,
      /([A-Z][\w\s&-]+)\s+(?:brand|company|corporation|inc\.?|ltd\.?|llc)/gi,
      /©\s*(\d{4}\s+)?([A-Z][\w\s&-]+)/gi // Copyright notices
    ];
    
    for (const product of products) {
      const text = product.description + ' ' + (product.source_url || '');
      
      for (const pattern of companyPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          const companyName = this.cleanText(match[2] || match[1]);
          if (companyName && companyName.length > 2) {
            companies.push({
              name: companyName,
              primary_focus: product.industry
            });
          }
        }
      }
    }
    
    // Deduplicate companies
    const uniqueCompanies = new Map<string, Company>();
    for (const company of companies) {
      const key = company.name.toLowerCase();
      if (!uniqueCompanies.has(key)) {
        uniqueCompanies.set(key, company);
      }
    }
    
    return Array.from(uniqueCompanies.values());
  }
}