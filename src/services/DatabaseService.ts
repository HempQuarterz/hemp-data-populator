import { supabase } from '../db/supabase';
import { logger } from '../utils/logger';
import { config } from '../config';
import { HempProduct } from '../types';

interface SaveResult {
  count: number;
  errors: string[];
}

export class DatabaseService {
  async createRun(agentName: string): Promise<string> {
    const { data, error } = await supabase
      .from(config.database.tables.runs)
      .insert({
        agent_name: agentName,
        timestamp: new Date().toISOString(),
        status: 'running',
        products_found: 0,
        products_saved: 0,
        companies_saved: 0
      })
      .select('id')
      .single();
    
    if (error) {
      logger.error('Failed to create run:', error);
      throw error;
    }
    
    return data.id;
  }
  
  async updateRun(runId: string, updates: any): Promise<void> {
    const { error } = await supabase
      .from(config.database.tables.runs)
      .update(updates)
      .eq('id', runId);
    
    if (error) {
      logger.error('Failed to update run:', error);
      throw error;
    }
  }
  
  async saveProducts(products: HempProduct[]): Promise<SaveResult> {
    if (products.length === 0) {
      return { count: 0, errors: [] };
    }
    
    logger.info(`Saving ${products.length} products to database...`);
    
    const result: SaveResult = { count: 0, errors: [] };
    
    // Process in batches
    const batchSize = config.database.batchSize;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      try {
        // Transform products to match the database schema
        const dbProducts = batch.map(product => ({
          name: product.product_name,
          description: product.description,
          plant_part: product.plant_part,
          industry: product.industry,
          benefits: product.benefits,
          technical_specifications: product.technical_specs,
          sustainability_aspects: product.sustainability_aspects,
          keywords: product.keywords,
          source_url: product.source_url,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        const { data, error } = await supabase
          .from(config.database.tables.products)
          .upsert(dbProducts, {
            onConflict: 'name,plant_part,industry',
            ignoreDuplicates: true
          })
          .select('id');
        
        if (error) {
          const errorMsg = `Batch insert error: ${error.message}`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);
        } else {
          result.count += data?.length || 0;
        }
      } catch (error) {
        const errorMsg = `Batch processing error: ${error}`;
        logger.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }
    
    logger.info(`Saved ${result.count} products`);
    return result;
  }
  
  async saveCompanies(companies: any[]): Promise<SaveResult> {
    if (companies.length === 0) {
      return { count: 0, errors: [] };
    }
    
    logger.info(`Saving ${companies.length} companies to database...`);
    
    const result: SaveResult = { count: 0, errors: [] };
    
    try {
      const { data, error } = await supabase
        .from(config.database.tables.companies)
        .upsert(companies, {
          onConflict: 'name',
          ignoreDuplicates: true
        })
        .select('id');
      
      if (error) {
        const errorMsg = `Company insert error: ${error.message}`;
        logger.error(errorMsg);
        result.errors.push(errorMsg);
      } else {
        result.count = data?.length || 0;
      }
    } catch (error) {
      const errorMsg = `Company processing error: ${error}`;
      logger.error(errorMsg);
      result.errors.push(errorMsg);
    }
    
    logger.info(`Saved ${result.count} companies`);
    return result;
  }
  
  async checkExistingProducts(hashes: string[]): Promise<Set<string>> {
    // In a real implementation, we'd store and check hashes
    // For now, we'll rely on the database's unique constraints
    return new Set();
  }
}