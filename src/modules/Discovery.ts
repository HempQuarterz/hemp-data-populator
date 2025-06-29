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
      this.getKnownGoodSources.bind(this),
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
  
  private async getKnownGoodSources(): Promise<DataSource[]> {
    // Curated list of known good hemp data sources
    const sources: DataSource[] = [
      // LOCAL SAMPLE DATA (highest priority for testing)
      {
        url: `file://${process.cwd()}/sample-data/hemp-products.csv`,
        type: 'csv',
        score: 0,
        license: 'Sample Data'
      },
      {
        url: `file://${process.cwd()}/sample-data/hemp-products-batch2.csv`,
        type: 'csv',
        score: 0,
        license: 'Sample Data'
      }
    ];
    
    // Check if sample files exist
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const validSources: DataSource[] = [];
      
      for (const source of sources) {
        if (source.url.startsWith('file://')) {
          const filePath = source.url.replace('file://', '');
          try {
            await fs.access(filePath);
            validSources.push(source);
            logger.info(`Found local sample data file: ${filePath}`);
          } catch {
            logger.warn(`Sample data file not found: ${filePath}`);
          }
        }
      }
      
      sources.length = 0;
      sources.push(...validSources);
    } catch (error) {
      logger.error('Error checking local files:', error);
    }
    
    // Add remote sources
    const remoteSources: DataSource[] = [
      // Working data sources based on recent searches
      {
        url: 'https://data.boston.gov/dataset/1192aba2-0099-45e9-bbbb-94208b9b70c9/resource/f53d03f4-f076-44f8-9cab-d6900b9a4444/download/cannabis-active-licenses.csv',
        type: 'csv',
        score: 0,
        license: 'Public Domain'
      },
      // Hemp/Cannabis industry sites that might have data
      {
        url: 'https://mjbizdaily.com/chart-of-the-week/',
        type: 'html',
        score: 0
      },
      {
        url: 'https://www.newcannabisventures.com/cannabis-company-revenue-ranking/',
        type: 'html',
        score: 0
      },
      // Academic and research sources
      {
        url: 'https://www.mdpi.com/2077-0472/10/4/129/htm',
        type: 'html',
        score: 0,
        license: 'CC BY'
      },
      // Hemp industry associations
      {
        url: 'https://thehia.org/resources/hemp-products/',
        type: 'html',
        score: 0
      },
      {
        url: 'https://hempindustrydaily.com/data/',
        type: 'html',
        score: 0
      },
      // Hemp business directories
      {
        url: 'https://ministryofhemp.com/hemp/uses/',
        type: 'html',
        score: 0
      },
      {
        url: 'https://www.leafly.com/news/strains-products/industrial-hemp-uses',
        type: 'html',
        score: 0
      }
    ];
    
    return [...sources, ...remoteSources];
  }
  
  private async searchWeb(): Promise<DataSource[]> {
    const sources: DataSource[] = [];
    
    // Additional known sources that might have hemp data
    const additionalSources = [
      {
        url: 'https://hemptoday.net/hemp-products-database/',
        type: 'html' as const,
        score: 0
      },
      {
        url: 'https://www.hempbenchmarks.com/hemp-market-data/',
        type: 'html' as const,
        score: 0
      },
      {
        url: 'https://www.brightfieldgroup.com/hemp-cbd-data',
        type: 'html' as const,
        score: 0
      }
    ];
    
    return [...sources, ...additionalSources];
  }
  
  private async searchGitHub(): Promise<DataSource[]> {
    try {
      // Search GitHub for hemp datasets
      const response = await axios.get('https://api.github.com/search/repositories', {
        params: {
          q: 'hemp dataset csv OR "hemp products" csv OR "industrial hemp" json in:readme',
          sort: 'updated',
          per_page: 10
        },
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': config.scraping.userAgent
        }
      });
      
      const sources: DataSource[] = [];
      
      for (const repo of response.data.items || []) {
        // Skip our own repository
        if (repo.full_name === 'HempQuarterz/hemp-data-populator') continue;
        
        // Look for data files in specific paths
        const dataFilePaths = [
          'data',
          'datasets',
          'csv',
          'json',
          ''  // root directory
        ];
        
        for (const path of dataFilePaths) {
          const contentsUrl = `https://api.github.com/repos/${repo.full_name}/contents/${path}`;
          try {
            const contentsResponse = await axios.get(contentsUrl, {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': config.scraping.userAgent
              }
            });
            const files = contentsResponse.data || [];
            
            for (const file of files) {
              if (typeof file === 'object' && file.name) {
                const fileName = file.name.toLowerCase();
                // Look for hemp-related data files
                if ((fileName.includes('hemp') || fileName.includes('cannabis')) &&
                    (fileName.endsWith('.csv') || fileName.endsWith('.json'))) {
                  sources.push({
                    url: file.download_url || file.url,
                    type: fileName.endsWith('.csv') ? 'csv' : 'json',
                    score: 0,
                    license: repo.license?.name
                  });
                }
              }
            }
          } catch (error) {
            // Skip if we can't access this path
          }
        }
      }
      
      return sources;
    } catch (error) {
      logger.error('GitHub search failed:', error);
      return [];
    }
  }
  
  private async searchDataPortals(): Promise<DataSource[]> {
    // Government and open data portals
    const portals = [
      {
        url: 'https://www.usda.gov/sites/default/files/documents/hemp-report.csv',
        type: 'csv' as const,
        score: 0,
        license: 'Public Domain'
      },
      {
        url: 'https://data.europa.eu/data/datasets?query=hemp&format=csv',
        type: 'html' as const,
        score: 0
      },
      {
        url: 'https://www150.statcan.gc.ca/n1/pub/32-26-0001/322600012020001-eng.csv',
        type: 'csv' as const,
        score: 0,
        license: 'Open Government License'
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
      
      if (source.url.includes('usda') || source.url.includes('europa')) {
        score += 0.15; // Extra bonus for government data
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
      'unlicense', 'creative commons', 'open data', 'open government'
    ];
    
    const lower = license.toLowerCase();
    return openLicenses.some(open => lower.includes(open));
  }
}