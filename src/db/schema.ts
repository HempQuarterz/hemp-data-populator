import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { config } from '../config';

export async function ensureSchema(): Promise<void> {
  logger.info('Checking database schema...');
  
  try {
    // Simple approach: try to select from each table
    const tablesToCheck = [
      { name: config.database.tables.products, displayName: 'Products' },
      { name: config.database.tables.companies, displayName: 'Companies' },
      { name: config.database.tables.runs, displayName: 'Agent Runs' }
    ];
    
    for (const table of tablesToCheck) {
      try {
        const { error } = await supabase
          .from(table.name)
          .select('id')
          .limit(1);
        
        if (error) {
          logger.error(`❌ Table ${table.name} check failed:`, error.message);
          throw new Error(`Required table '${table.name}' is not accessible or doesn't exist`);
        } else {
          logger.info(`✅ ${table.displayName} table verified: ${table.name}`);
        }
      } catch (err) {
        logger.error(`Failed to access ${table.name}:`, err);
        throw err;
      }
    }
    
    logger.info('✅ All required tables verified');
    
  } catch (error) {
    logger.error('Schema verification failed:', error);
    throw error;
  }
}