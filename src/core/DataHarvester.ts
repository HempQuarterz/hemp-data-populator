import { CronJob } from 'cron';
import { logger } from '../utils/logger';
import { Discovery } from '../modules/Discovery';
import { Scraper } from '../modules/Scraper';
import { DataProcessor } from '../modules/DataProcessor';
import { DatabaseService } from '../services/DatabaseService';
import { HarvestRunResult, DataSource } from '../types';
import { ensureSchema, verifyConnection } from '../db';

export class DataHarvester {
  private discovery: Discovery;
  private scraper: Scraper;
  private processor: DataProcessor;
  private database: DatabaseService;
  private cronJob?: CronJob;

  constructor() {
    this.discovery = new Discovery();
    this.scraper = new Scraper();
    this.processor = new DataProcessor();
    this.database = new DatabaseService();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing DataHarvester...');
    
    // Verify database connection
    const connected = await verifyConnection();
    if (!connected) {
      throw new Error('Failed to connect to Supabase');
    }
    
    // Ensure schema is ready
    await ensureSchema();
    
    logger.info('✅ DataHarvester initialized');
  }

  async runOnce(): Promise<HarvestRunResult> {
    await this.initialize();
    
    const startTime = Date.now();
    const runId = await this.database.createRun('DataHarvester-Bot');
    
    try {
      logger.info('🔍 Starting discovery phase...');
      const sources = await this.discovery.findDataSources();
      logger.info(`Found ${sources.length} potential data sources`);
      
      const result: HarvestRunResult = {
        products_found: 0,
        products_saved: 0,
        companies_saved: 0,
        duplicates_skipped: 0,
        errors: [],
        duration_ms: 0
      };
      
      // Process each source
      for (const source of sources) {
        try {
          logger.info(`🌐 Processing: ${source.url}`);
          
          // Scrape the source
          const scrapeResult = await this.scraper.scrape(source);
          result.products_found += scrapeResult.products.length;
          
          // Process and deduplicate
          const processed = await this.processor.process(scrapeResult.products);
          
          // Save to database
          const saved = await this.database.saveProducts(processed.unique);
          result.products_saved += saved.count;
          result.duplicates_skipped += processed.duplicates;
          
          // Extract and save companies
          const companies = await this.processor.extractCompanies(processed.unique);
          const savedCompanies = await this.database.saveCompanies(companies);
          result.companies_saved += savedCompanies.count;
          
        } catch (error) {
          const errorMsg = `Failed to process ${source.url}: ${error}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
      
      result.duration_ms = Date.now() - startTime;
      
      // Update run status
      await this.database.updateRun(runId, {
        status: 'completed',
        products_found: result.products_found,
        products_saved: result.products_saved,
        companies_saved: result.companies_saved,
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null
      });
      
      logger.info('✅ Harvest completed:', result);
      return result;
      
    } catch (error) {
      await this.database.updateRun(runId, {
        status: 'failed',
        error_message: String(error)
      });
      throw error;
    }
  }

  async runTrigger(urls: string[]): Promise<HarvestRunResult> {
    await this.initialize();
    
    const startTime = Date.now();
    const runId = await this.database.createRun('DataHarvester-Bot (Trigger)');
    
    try {
      logger.info(`🎯 Processing ${urls.length} triggered URLs`);
      
      const result: HarvestRunResult = {
        products_found: 0,
        products_saved: 0,
        companies_saved: 0,
        duplicates_skipped: 0,
        errors: [],
        duration_ms: 0
      };
      
      // Convert URLs to DataSource objects
      const sources: DataSource[] = urls.map(url => ({
        url,
        type: this.detectSourceType(url),
        score: 1.0 // Max score for manually triggered URLs
      }));
      
      // Process each source (similar to runOnce)
      for (const source of sources) {
        try {
          logger.info(`🌐 Processing triggered URL: ${source.url}`);
          
          const scrapeResult = await this.scraper.scrape(source);
          result.products_found += scrapeResult.products.length;
          
          const processed = await this.processor.process(scrapeResult.products);
          const saved = await this.database.saveProducts(processed.unique);
          result.products_saved += saved.count;
          result.duplicates_skipped += processed.duplicates;
          
          const companies = await this.processor.extractCompanies(processed.unique);
          const savedCompanies = await this.database.saveCompanies(companies);
          result.companies_saved += savedCompanies.count;
          
        } catch (error) {
          const errorMsg = `Failed to process ${source.url}: ${error}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }
      
      result.duration_ms = Date.now() - startTime;
      
      await this.database.updateRun(runId, {
        status: 'completed',
        products_found: result.products_found,
        products_saved: result.products_saved,
        companies_saved: result.companies_saved,
        error_message: result.errors.length > 0 ? result.errors.join('; ') : null
      });
      
      logger.info('✅ Trigger run completed:', result);
      return result;
      
    } catch (error) {
      await this.database.updateRun(runId, {
        status: 'failed',
        error_message: String(error)
      });
      throw error;
    }
  }

  async runSchedule(cronExpression: string): Promise<void> {
    await this.initialize();
    
    logger.info(`🕰️ Setting up scheduled runs: ${cronExpression}`);
    
    this.cronJob = new CronJob(
      cronExpression,
      async () => {
        logger.info('🔔 Scheduled run triggered');
        try {
          await this.runOnce();
        } catch (error) {
          logger.error('Scheduled run failed:', error);
        }
      },
      null,
      true,
      'UTC'
    );
    
    logger.info('✅ Scheduler started. Press Ctrl+C to stop.');
    
    // Keep the process running
    await new Promise(() => {});
  }

  private detectSourceType(url: string): 'html' | 'csv' | 'json' | 'pdf' {
    const lower = url.toLowerCase();
    if (lower.endsWith('.csv')) return 'csv';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.pdf')) return 'pdf';
    return 'html';
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('Scheduler stopped');
    }
  }
}