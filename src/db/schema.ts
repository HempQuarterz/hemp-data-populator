import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function ensureSchema(): Promise<void> {
  logger.info('Checking database schema...');
  
  try {
    // Check if we need to create hemp_uses table or use existing tables
    const { data: tables } = await supabase.rpc('pg_tables', {
      schemaname: 'public'
    });
    
    const existingTables = tables?.map((t: any) => t.tablename) || [];
    
    // We'll use the existing hemp_automation_products table
    if (!existingTables.includes(config.database.tables.products)) {
      logger.warn(`Table ${config.database.tables.products} not found. It should exist.`);
    } else {
      logger.info(`✅ Using existing table: ${config.database.tables.products}`);
    }
    
    // Check for companies table
    if (!existingTables.includes(config.database.tables.companies)) {
      logger.warn(`Table ${config.database.tables.companies} not found. It should exist.`);
    } else {
      logger.info(`✅ Using existing table: ${config.database.tables.companies}`);
    }
    
    // Check for runs table
    if (!existingTables.includes(config.database.tables.runs)) {
      logger.warn(`Table ${config.database.tables.runs} not found. It should exist.`);
    } else {
      logger.info(`✅ Using existing table: ${config.database.tables.runs}`);
    }
    
    // Add any necessary indexes for performance
    await createIndexesIfNeeded();
    
  } catch (error) {
    logger.error('Schema verification failed:', error);
    throw error;
  }
}

async function createIndexesIfNeeded(): Promise<void> {
  try {
    // Create index on product name and plant_part for faster deduplication
    const indexName = 'idx_hemp_products_dedup';
    
    const { error } = await supabase.rpc('create_index_if_not_exists', {
      index_name: indexName,
      table_name: config.database.tables.products,
      columns: ['name', 'plant_part', 'industry']
    }).single();
    
    if (error && !error.message?.includes('already exists')) {
      logger.warn('Could not create index:', error);
    } else {
      logger.info('✅ Deduplication index ready');
    }
  } catch (error) {
    // Index creation is not critical, so we just log the warning
    logger.warn('Index creation skipped:', error);
  }
}