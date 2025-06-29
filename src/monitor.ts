import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { logger } from './utils/logger';

dotenvConfig();

async function getStats() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Get product statistics
    const { data: productStats, error: productError } = await supabase
      .from(config.database.tables.products)
      .select('industry, plant_part', { count: 'exact' });
    
    if (productError) throw productError;
    
    // Get total count
    const { count: totalProducts } = await supabase
      .from(config.database.tables.products)
      .select('*', { count: 'exact', head: true });
    
    // Get industry breakdown
    const industryCount = productStats?.reduce((acc: any, product: any) => {
      acc[product.industry] = (acc[product.industry] || 0) + 1;
      return acc;
    }, {});
    
    // Get plant part breakdown
    const plantPartCount = productStats?.reduce((acc: any, product: any) => {
      acc[product.plant_part] = (acc[product.plant_part] || 0) + 1;
      return acc;
    }, {});
    
    // Get recent runs
    const { data: recentRuns } = await supabase
      .from(config.database.tables.runs)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    // Get companies count
    const { count: totalCompanies } = await supabase
      .from(config.database.tables.companies)
      .select('*', { count: 'exact', head: true });
    
    console.log('\\n🌱 Hemp Data Populator Statistics 🌱\\n');
    console.log('=' .repeat(50));
    
    console.log(`\\n📊 Total Products: ${totalProducts}`);
    console.log(`🏢 Total Companies: ${totalCompanies}`);
    
    console.log('\\n🏭 Products by Industry:');
    if (industryCount) {
      Object.entries(industryCount)
        .sort(([,a]: any, [,b]: any) => b - a)
        .forEach(([industry, count]) => {
          console.log(`  • ${industry}: ${count}`);
        });
    }
    
    console.log('\\n🌿 Products by Plant Part:');
    if (plantPartCount) {
      Object.entries(plantPartCount)
        .sort(([,a]: any, [,b]: any) => b - a)
        .forEach(([part, count]) => {
          console.log(`  • ${part}: ${count}`);
        });
    }
    
    console.log('\\n📅 Recent Harvest Runs:');
    if (recentRuns && recentRuns.length > 0) {
      recentRuns.forEach((run: any) => {
        const date = new Date(run.created_at).toLocaleString();
        console.log(`  • ${date} - Products: ${run.products_found}, Saved: ${run.products_saved}`);
      });
    } else {
      console.log('  No recent runs found');
    }
    
    console.log('\\n' + '=' .repeat(50));
    
  } catch (error) {
    logger.error('Error fetching statistics:', error);
  }
  
  process.exit(0);
}

// Run the stats
getStats();
