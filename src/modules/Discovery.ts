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
      }
    ];
    
    // Check if sample file exists
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const samplePath = path.join(process.cwd(), 'sample-data', 'hemp-products.csv');
      await fs.access(samplePath);
      logger.info('Found local sample data file');
    } catch {
      logger.warn('Sample data file not found, using remote sources only');
      sources.shift(); // Remove local file if it doesn't exist
    }
    
    // Add remote sources
    const remoteSources: DataSource[] = [
      // GitHub Cannabis/Hemp Datasets
      {
        url: 'https://raw.githubusercontent.com/kushyapp/cannabis-dataset/master/dataset/Strains.csv',
        type: 'csv',
        score: 0,
        license: 'MIT'
      },
      {
        url: 'https://raw.githubusercontent.com/kushyapp/cannabis-dataset/master/dataset/Products.csv',
        type: 'csv',
        score: 0,
        license: 'MIT'
      },
      {
        url: 'https://downloads.usda.library.cornell.edu/usda-esmis/files/gf06h2430/3t947c84r/mg74s940n/hempan24.pdf',
        type: 'pdf',
        score: 0,
        license: 'Public Domain'
      },
      // Hemp Industry Associations
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
      // Academic sources
      {
        url: 'https://www.mdpi.com/2077-0472/10/4/129/htm',
        type: 'html',
        score: 0,
        license: 'CC BY'
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
      },
      // USDA Hemp Data
      {
        url: 'https://quickstats.nass.usda.gov/api/api_GET',
        type: 'json',
        score: 0,
        license: 'Public Domain'
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