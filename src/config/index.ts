export const config = {
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
  },
  scraping: {
    rateLimitDelayMs: parseInt(process.env.RATE_LIMIT_DELAY_MS || '1000'),
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '2'),
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (compatible; HempDataBot/1.0)',
    timeout: 30000 // 30 seconds
  },
  discovery: {
    searchQueries: [
      '"industrial hemp uses" filetype:csv',
      '"hemp products database" OR "hemp applications list"',
      '"industrial hemp" dataset OR spreadsheet',
      '"hemp fiber" OR "hemp seed" OR "hemp oil" uses list',
      'site:data.gov hemp OR cannabis sativa',
      'site:github.com hemp dataset csv json'
    ],
    scoringWeights: {
      datasetSize: 0.3,
      license: 0.2,
      structure: 0.3,
      freshness: 0.2
    },
    minScoreThreshold: 0.6
  },
  database: {
    batchSize: 500,
    tables: {
      products: 'hemp_automation_products', // Using existing table
      companies: 'hemp_automation_companies', // Using existing table
      runs: 'hemp_agent_runs' // Using existing table
    }
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  python: {
    scriptsPath: process.env.PYTHON_SCRIPTS_PATH || './scripts/python'
  }
};