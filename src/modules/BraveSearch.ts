import axios from 'axios';
import { logger } from '../utils/logger';
import { DataSource } from '../types';

export class BraveSearch {
  private apiKey: string;
  private apiUrl = 'https://api.search.brave.com/res/v1/web/search';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async searchForHempData(): Promise<DataSource[]> {
    const queries = [
      'hemp products database CSV download',
      'industrial hemp dataset JSON',
      'hemp industry data filetype:csv',
      'cannabis hemp products list download',
      'hemp market research data'
    ];
    
    const allSources: DataSource[] = [];
    
    for (const query of queries) {
      try {
        const response = await axios.get(this.apiUrl, {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': this.apiKey
          },
          params: {
            q: query,
            count: 10
          }
        });
        
        const results = response.data.web?.results || [];
        
        for (const result of results) {
          // Look for data file indicators
          const url = result.url;
          const title = result.title?.toLowerCase() || '';
          const description = result.description?.toLowerCase() || '';
          
          let type: 'csv' | 'json' | 'html' | 'pdf' = 'html';
          
          if (url.endsWith('.csv') || title.includes('csv') || description.includes('csv')) {
            type = 'csv';
          } else if (url.endsWith('.json') || title.includes('json')) {
            type = 'json';
          } else if (url.endsWith('.pdf')) {
            type = 'pdf';
          }
          
          // Check if it's likely to contain hemp data
          const relevantTerms = ['hemp', 'cannabis', 'product', 'database', 'dataset'];
          const isRelevant = relevantTerms.some(term => 
            title.includes(term) || description.includes(term)
          );
          
          if (isRelevant) {
            allSources.push({
              url: url,
              type: type,
              score: 0
            });
          }
        }
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logger.error('Brave search error:', error);
      }
    }
    
    // Remove duplicates
    const uniqueSources = Array.from(
      new Map(allSources.map(item => [item.url, item])).values()
    );
    
    logger.info(`Brave Search found ${uniqueSources.length} potential sources`);
    return uniqueSources;
  }
  
  async searchForCompanies(): Promise<string[]> {
    const queries = [
      'hemp companies directory',
      'hemp product manufacturers list',
      'industrial hemp producers'
    ];
    
    const companies: string[] = [];
    
    for (const query of queries) {
      try {
        const response = await axios.get(this.apiUrl, {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': this.apiKey
          },
          params: {
            q: query,
            count: 20
          }
        });
        
        const results = response.data.web?.results || [];
        
        for (const result of results) {
          // Extract company names from titles and URLs
          const title = result.title || '';
          const url = result.url || '';
          
          // Simple heuristic to identify company names
          const potentialCompanies = title.match(/([A-Z][a-z]+ )+(?:Hemp|Cannabis|CBD|Inc|LLC|Corp|Company)/g) || [];
          companies.push(...potentialCompanies);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logger.error('Brave search companies error:', error);
      }
    }
    
    // Clean and deduplicate
    const uniqueCompanies = [...new Set(companies.map(c => c.trim()))];
    
    logger.info(`Found ${uniqueCompanies.length} potential hemp companies`);
    return uniqueCompanies;
  }
}
