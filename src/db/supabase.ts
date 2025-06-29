import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from '../utils/logger';

// Initialize Supabase client
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Verify connection
export async function verifyConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from(config.database.tables.runs)
      .select('count')
      .limit(1);
    
    if (error) {
      logger.error('Supabase connection error:', error);
      return false;
    }
    
    logger.info('✅ Supabase connection verified');
    return true;
  } catch (error) {
    logger.error('Failed to verify Supabase connection:', error);
    return false;
  }
}