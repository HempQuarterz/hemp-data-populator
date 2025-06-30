import { logger } from '../utils/logger';
import { DataSource } from '../types';
import axios from 'axios';

export class SourceValidator {
  // Blacklisted sources that have proven to contain junk data
  private blacklistedDomains = [
    'gist.githubusercontent.com/petroniocandido',
    // Add more as you discover bad sources
  ];
  
  // Trusted sources that consistently provide quality data
  private trustedDomains = [
    'usda.gov',
    'europa.eu',
    'data.gov',
    'hemp.org',
    'thehia.org',
    // Add more trusted sources
  ];
  
  async validateSource(source: DataSource): Promise<boolean> {
    try {
      // Check blacklist
      if (this.isBlacklisted(source.url)) {
        logger.warn(`Source blacklisted: ${source.url}`);
        return false;
      }
      
      // Local files are always valid (your curated data)
      if (source.url.startsWith('file://')) {
        return true;
      }
      
      // Give trusted sources a pass
      if (this.isTrusted(source.url)) {
        logger.info(`Trusted source: ${source.url}`);
        return true;
      }
      
      // For CSV/JSON files, do a preview check
      if (source.type === 'csv' || source.type === 'json') {
        return await this.previewDataQuality(source);
      }
      
      return true;
    } catch (error) {
      logger.error(`Source validation error for ${source.url}:`, error);
      return false;
    }
  }
  
  private isBlacklisted(url: string): boolean {
    return this.blacklistedDomains.some(domain => url.includes(domain));
  }
  
  private isTrusted(url: string): boolean {
    return this.trustedDomains.some(domain => url.includes(domain));
  }
  
  private async previewDataQuality(source: DataSource): Promise<boolean> {
    try {
      // Fetch first 50KB to preview
      const response = await axios.get(source.url, {
        headers: { 
          'Range': 'bytes=0-51200',
          'User-Agent': 'Hemp Data Validator/1.0'
        },
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      
      const preview = response.data;
      const previewStr = typeof preview === 'string' ? preview : JSON.stringify(preview);
      
      // Check for quality indicators
      let qualityScore = 0;
      
      // Contains hemp-related keywords
      if (/hemp|cannabis|cbd/i.test(previewStr)) {
        qualityScore += 2;
      }
      
      // Has proper headers (for CSV)
      if (source.type === 'csv') {
        const firstLine = previewStr.split('\\n')[0];
        if (/name|product|description/i.test(firstLine)) {
          qualityScore += 1;
        }
        // Check for numeric header names (bad sign)
        if (/^[\\d,]+$/.test(firstLine)) {
          logger.warn(`Suspicious CSV headers: ${firstLine}`);
          return false;
        }
      }
      
      // Check for junk patterns
      const lines = previewStr.split('\\n').slice(0, 10);
      let numericLines = 0;
      
      for (const line of lines) {
        // Line is mostly numbers
        if (/^[\\d,\\s]+$/.test(line.trim())) {
          numericLines++;
        }
      }
      
      // If more than half the lines are just numbers, it's probably junk
      if (numericLines > lines.length / 2) {
        logger.warn(`Source appears to contain junk data: ${source.url}`);
        return false;
      }
      
      // Minimum quality threshold
      return qualityScore >= 1;
      
    } catch (error) {
      logger.error(`Preview fetch failed for ${source.url}:`, error);
      // If we can't preview, be conservative
      return false;
    }
  }
  
  // Validate data after scraping but before processing
  validateScrapedData(data: any[], source: string): boolean {
    if (!data || data.length === 0) {
      return true; // Empty is ok, just no data
    }
    
    // Sample the data
    const sample = data.slice(0, Math.min(10, data.length));
    
    let validCount = 0;
    let invalidCount = 0;
    
    for (const item of sample) {
      // Check if it looks like a hemp product
      if (this.isValidProductData(item)) {
        validCount++;
      } else {
        invalidCount++;
      }
    }
    
    // If more than 50% of sample is invalid, reject the whole batch
    if (invalidCount > validCount) {
      logger.error(`Rejecting data from ${source}: ${invalidCount}/${sample.length} items invalid`);
      return false;
    }
    
    return true;
  }
  
  private isValidProductData(item: any): boolean {
    // Must have a name
    if (!item.product_name && !item.name) {
      return false;
    }
    
    const name = item.product_name || item.name || '';
    
    // Name can't be just a number
    if (/^\\d+$/.test(name)) {
      return false;
    }
    
    // Should have some meaningful fields
    const meaningfulFields = [
      item.description,
      item.plant_part,
      item.industry,
      item.benefits,
      item.use,
      item.category
    ].filter(f => f && f.length > 2);
    
    // Need at least one meaningful field besides name
    return meaningfulFields.length >= 1;
  }
}
