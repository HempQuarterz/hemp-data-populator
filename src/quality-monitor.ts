import { config as dotenvConfig } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { config } from './config';
import { logger } from './utils/logger';

dotenvConfig();

interface QualityReport {
  totalProducts: number;
  suspiciousProducts: number;
  numericNames: number;
  shortNames: number;
  missingDescriptions: number;
  invalidPlantParts: number;
  invalidIndustries: number;
  recommendations: string[];
}

async function checkDataQuality(): Promise<QualityReport> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const report: QualityReport = {
    totalProducts: 0,
    suspiciousProducts: 0,
    numericNames: 0,
    shortNames: 0,
    missingDescriptions: 0,
    invalidPlantParts: 0,
    invalidIndustries: 0,
    recommendations: []
  };
  
  try {
    // Check hemp_automation_products table
    const { data: products, error } = await supabase
      .from(config.database.tables.products)
      .select('*');
    
    if (error) throw error;
    
    report.totalProducts = products?.length || 0;
    
    const validPlantParts = [
      'seed', 'seeds', 'fiber', 'fibre', 'flower', 'leaves', 
      'stem', 'hurds', 'roots', 'oil', 'whole plant', 'biomass'
    ];
    
    for (const product of products || []) {
      let isSuspicious = false;
      
      // Check for numeric names
      if (/^\d+$/.test(product.name)) {
        report.numericNames++;
        isSuspicious = true;
      }
      
      // Check for short names
      if (product.name.length < 3) {
        report.shortNames++;
        isSuspicious = true;
      }
      
      // Check for missing descriptions
      if (!product.description || product.description.trim() === '') {
        report.missingDescriptions++;
      }
      
      // Check plant parts
      const plantPartLower = product.plant_part?.toLowerCase() || '';
      if (!validPlantParts.some(part => plantPartLower.includes(part))) {
        report.invalidPlantParts++;
        isSuspicious = true;
      }
      
      // Check industries
      if (product.industry === 'Other' || /^\d+$/.test(product.industry || '')) {
        report.invalidIndustries++;
        isSuspicious = true;
      }
      
      if (isSuspicious) {
        report.suspiciousProducts++;
      }
    }
    
    // Generate recommendations
    if (report.numericNames > 0) {
      report.recommendations.push(
        `Found ${report.numericNames} products with numeric names - run cleanup!`
      );
    }
    
    if (report.invalidPlantParts > 5) {
      report.recommendations.push(
        `${report.invalidPlantParts} products have invalid plant parts - review data sources`
      );
    }
    
    if (report.missingDescriptions > report.totalProducts * 0.2) {
      report.recommendations.push(
        `Over 20% of products lack descriptions - improve scraping quality`
      );
    }
    
    if (report.suspiciousProducts === 0) {
      report.recommendations.push('✅ Data quality looks good!');
    }
    
  } catch (error) {
    logger.error('Error checking data quality:', error);
  }
  
  return report;
}

async function cleanJunkData(): Promise<number> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    // Delete products with numeric names
    const { data, error } = await supabase
      .from(config.database.tables.products)
      .delete()
      .or('name.match.^\\d+$,plant_part.match.^\\d+$,industry.eq.Other')
      .select();
    
    if (error) throw error;
    
    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
      logger.info(`Cleaned ${deletedCount} junk products`);
    }
    
    return deletedCount;
    
  } catch (error) {
    logger.error('Error cleaning data:', error);
    return 0;
  }
}

// Main execution
async function main() {
  console.log('\\n🔍 Hemp Data Quality Monitor 🔍\\n');
  console.log('=' .repeat(50));
  
  const report = await checkDataQuality();
  
  console.log(`\\n📊 Data Quality Report:`);
  console.log(`Total Products: ${report.totalProducts}`);
  console.log(`Suspicious Products: ${report.suspiciousProducts}`);
  
  if (report.suspiciousProducts > 0) {
    console.log('\\n⚠️  Issues Found:');
    console.log(`  • Numeric Names: ${report.numericNames}`);
    console.log(`  • Short Names (<3 chars): ${report.shortNames}`);
    console.log(`  • Missing Descriptions: ${report.missingDescriptions}`);
    console.log(`  • Invalid Plant Parts: ${report.invalidPlantParts}`);
    console.log(`  • Invalid Industries: ${report.invalidIndustries}`);
  }
  
  console.log('\\n💡 Recommendations:');
  report.recommendations.forEach(rec => {
    console.log(`  • ${rec}`);
  });
  
  // Auto-clean if requested
  if (process.argv.includes('--clean') && report.suspiciousProducts > 0) {
    console.log('\\n🧹 Running automatic cleanup...');
    const cleaned = await cleanJunkData();
    console.log(`Cleaned ${cleaned} junk products`);
  }
  
  console.log('\\n' + '=' .repeat(50));
  process.exit(0);
}

main();
