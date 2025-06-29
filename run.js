// Load environment variables
require('dotenv').config({ path: __dirname + '/.env' });

// Show loaded variables for debugging
console.log('Loading environment from:', __dirname + '/.env');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Loaded' : 'Not loaded');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Loaded' : 'Not loaded');

// Run the TypeScript file using tsx
const { execSync } = require('child_process');
const args = process.argv.slice(2).join(' ');

try {
  execSync(`npx tsx src/index.ts ${args}`, { 
    stdio: 'inherit',
    env: process.env 
  });
} catch (error) {
  process.exit(1);
}