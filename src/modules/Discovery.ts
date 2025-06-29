import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../config';
import { DataSource } from '../types';

export class Discovery {
  async findDataSources(): Promise<DataSource[]> {
    logger.info('Starting data source discovery...');
    
    const allSources: DataSource[] = [];
    
    // Search using multiple strategies
    const strategies = [
      this.searchWeb.bind(this),
      this.searchGitHub.bind(this),
      this.searchDataPortals.bind(this)
    ];
    
    for (const strategy of strategies) {
      try {
        const sources = await strategy();
        allSources.push(...sources);
      } catch (error) {
        logger.error('Discovery strategy failed:', error);
      }
    }
    
    // Score and filter sources
    const scoredSources = this.scoreSources(allSources);
    const filteredSources = scoredSources.filter(
      source => source.score >= config.discovery.minScoreThreshold
    );
    
    // Sort by score (highest first)
    filteredSources.sort((a, b) => b.score - a.score);
    
    logger.info(`Discovery complete. Found ${filteredSources.length} viable sources`);
    return filteredSources.slice(0, 10); // Top 10 sources
  }
  
  private async searchWeb(): Promise<DataSource[]> {
    const sources: DataSource[] = [];
    
    // In a real implementation, this would use a search API
    // For now, we'll use some known good sources
    const knownSources = [
      {
        url: 'https://www.votehemp.com/hemp-resources/hemp-facts/',
        type: 'html' as const,
        score: 0
      },
      {
        url: 'https://www.naihc.org/hemp_information/hemp_facts.html',
        type: 'html' as const,
        score: 0
      },
      {
        url: 'https://hempindustrydaily.com/hemp-uses/',
        type: 'html' as const,
        score: 0
      }
    ];
    
    return knownSources;
  }
  
  private async searchGitHub(): Promise<DataSource[]> {
    try {
      // Search GitHub for hemp datasets
      const response = await axios.get('https://api.github.com/search/repositories', {
        params: {
          q: 'hemp dataset OR "industrial hemp" data',
          sort: 'updated',
          per_page: 5
        },
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': config.scraping.userAgent
        }
      });
      
      const sources: DataSource[] = [];
      
      for (const repo of response.data.items || []) {
        // Look for CSV/JSON files in the repo
        const contentsUrl = `https://api.github.com/repos/${repo.full_name}/contents`;
        try {
          const contentsResponse = await axios.get(contentsUrl);
          const files = contentsResponse.data || [];
          
          for (const file of files) {
            if (file.name.endsWith('.csv') || file.name.endsWith('.json')) {
              sources.push({
                url: file.download_url,
                type: file.name.endsWith('.csv') ? 'csv' : 'json',
                score: 0,
                license: repo.license?.name
              });
            }
          }
        } catch (error) {
          // Skip repos we can't access
        }
      }
      
      return sources;
    } catch (error) {
      logger.error('GitHub search failed:', error);
      return [];
    }
  }
  
  private async searchDataPortals(): Promise<DataSource[]> {
    // Known data portals with hemp data
    const portals = [
      {
        url: 'https://www.data.gov/dataset/search?q=hemp',
        type: 'html' as const,
        score: 0
      },
      {
        url: 'https://catalog.data.gov/dataset?q=industrial+hemp',
        type: 'html' as const,
        score: 0
      }
    ];
    
    return portals;
  }
  
  private scoreSources(sources: DataSource[]): DataSource[] {
    return sources.map(source => {
      let score = 0;
      const weights = config.discovery.scoringWeights;
      
      // Score based on file type
      if (source.type === 'csv' || source.type === 'json') {
        score += weights.structure * 1.0;
      } else if (source.type === 'html') {
        score += weights.structure * 0.5;
      } else if (source.type === 'pdf') {
        score += weights.structure * 0.3;
      }
      
      // Score based on license
      if (source.license && this.isOpenLicense(source.license)) {
        score += weights.license * 1.0;
      } else {
        score += weights.license * 0.5; // Unknown license
      }
      
      // Score based on URL patterns
      if (source.url.includes('.gov') || source.url.includes('.org')) {
        score += 0.1; // Bonus for official sources
      }
      
      // Estimate dataset size (would need actual file size in real implementation)
      score += weights.datasetSize * 0.5; // Default medium size
      
      // Freshness (would need last-modified date in real implementation)
      score += weights.freshness * 0.5; // Default medium freshness
      
      return { ...source, score };
    });
  }
  
  private isOpenLicense(license: string): boolean {
    const openLicenses = [
      'mit', 'apache', 'gpl', 'bsd', 'cc-by', 'cc0', 'public domain',
      'unlicense', 'creative commons', 'open data'
    ];
    
    const lower = license.toLowerCase();
    return openLicenses.some(open => lower.includes(open));
  }
}