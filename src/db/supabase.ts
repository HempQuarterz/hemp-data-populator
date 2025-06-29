import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from '../utils/logger';

// Lazy-load Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    // Check if config values are available
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('Supabase configuration missing. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    }
    
    supabaseClient = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  
  return supabaseClient;
}

// Export a getter for backward compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  }
});

// Verify connection
export async function verifyConnection(): Promise<boolean> {
  try {
    const client = getSupabase();
    const { data, error } = await client
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