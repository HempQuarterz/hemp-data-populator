# Hemp Data Populator

Autonomous data harvester for industrial hemp uses and products, powered by MCP (Model-Context-Protocol).

## 🌟 Features

- 🤖 **Autonomous Discovery**: Intelligently finds hemp product datasets across the web
- 🔍 **Smart Scraping**: Handles HTML, CSV, JSON, and PDF formats
- 🔄 **Deduplication**: SHA-256 hash-based duplicate detection
- 📊 **Supabase Integration**: Direct storage to your existing database
- ⏰ **Scheduled Runs**: GitHub Actions automation
- 🐍 **Hybrid Approach**: Node.js + Python for optimal processing
- 📈 **Data Enrichment**: Automatic extraction of benefits, sustainability aspects, and keywords
- 🔒 **Legal Compliance**: Respects robots.txt and rate limits

## 📋 Prerequisites

- Node.js 20+ 
- Python 3.8+ (for PDF processing)
- Supabase project with appropriate tables
- GitHub repository (for scheduled runs)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/HempQuarterz/hemp-data-populator.git
cd hemp-data-populator
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Run Once

```bash
npm run run:once
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access | Required |
| `RATE_LIMIT_DELAY_MS` | Delay between requests in milliseconds | 1000 |
| `MAX_CONCURRENT_REQUESTS` | Maximum parallel requests | 2 |
| `USER_AGENT` | User agent for web requests | HempDataBot/1.0 |
| `LOG_LEVEL` | Logging verbosity (error/warn/info/debug) | info |

### Database Schema

The harvester uses these existing tables in your Supabase database:

#### hemp_automation_products
```sql
- id: UUID (primary key)
- name: TEXT
- description: TEXT  
- plant_part: TEXT
- industry: TEXT
- benefits: TEXT[]
- technical_specifications: JSONB
- sustainability_aspects: TEXT[]
- keywords: TEXT[]
- source_url: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### hemp_automation_companies
```sql
- id: UUID (primary key)
- name: TEXT (unique)
- website: TEXT
- description: TEXT
- primary_focus: TEXT
- created_at: TIMESTAMP
```

#### hemp_agent_runs
```sql
- id: UUID (primary key)
- agent_name: TEXT
- timestamp: TIMESTAMP
- products_found: INTEGER
- products_saved: INTEGER
- companies_saved: INTEGER
- status: TEXT
- error_message: TEXT
```

## 🏃 Run Modes

### 1. Once Mode
Execute the full discovery and scraping workflow one time:
```bash
npm run run:once
```

### 2. Trigger Mode
Manually specify URLs to scrape:
```bash
npm run run:trigger -- --urls="https://example.com/hemp-data.csv,https://example.org/products.json"
```

### 3. Schedule Mode (Local)
Run on a cron schedule locally:
```bash
npm run dev -- --mode=schedule --cron="0 */6 * * *"  # Every 6 hours
```

### 4. GitHub Actions (Recommended for Production)
The repository includes a GitHub Actions workflow that runs daily at 2 AM UTC.

To enable:
1. Go to Settings → Secrets and variables → Actions
2. Add repository secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. The workflow will run automatically on schedule

You can also trigger manually from Actions tab → Hemp Data Harvest → Run workflow.

## 🔍 Discovery Process

The harvester uses multiple strategies to find hemp data:

1. **Web Search**: Queries for hemp product datasets
2. **GitHub Search**: Finds CSV/JSON files in hemp-related repositories  
3. **Data Portals**: Searches government and open data portals

Sources are scored based on:
- Data structure (CSV/JSON preferred)
- License (open licenses scored higher)
- Estimated dataset size
- Freshness of data

Only sources scoring above 0.6 are processed.

## 🐍 PDF Processing (Hybrid Approach)

For PDF files, the harvester can use a Python script:

```bash
# Install Python dependencies
pip install -r scripts/python/requirements.txt

# Process a PDF manually
python scripts/python/pdf_processor.py document.pdf
```

The Node.js scraper automatically calls this script when encountering PDFs.

## 📊 Data Processing Pipeline

1. **Discovery**: Find potential data sources
2. **Scraping**: Extract raw data from sources
3. **Cleaning**: Normalize text, remove control characters
4. **Deduplication**: SHA-256 hash on (name + part + industry)
5. **Enrichment**: Extract benefits, sustainability aspects, keywords
6. **Company Extraction**: Identify companies from descriptions
7. **Storage**: Batch upsert to Supabase

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build
```

### Project Structure

```
hemp-data-populator/
├── src/
│   ├── core/           # Main orchestrator
│   ├── modules/        # Discovery, Scraping, Processing
│   ├── services/       # Database service
│   ├── db/            # Supabase client and schema
│   ├── utils/         # Helpers and logging
│   ├── config/        # Configuration
│   └── types/         # TypeScript types
├── scripts/
│   └── python/        # PDF processing scripts
├── .github/
│   └── workflows/     # GitHub Actions
└── logs/             # Application logs
```

## 📈 Monitoring

The harvester tracks metrics for each run:
- Products found
- Products saved (after deduplication)
- Companies extracted and saved
- Errors encountered
- Processing duration

View run history in the `hemp_agent_runs` table.

## 🔒 Security & Compliance

- Respects robots.txt
- Rate limits requests (configurable)
- Only processes publicly available data
- Checks for open licenses
- User agent identifies bot traffic

## 🐛 Troubleshooting

### Common Issues

1. **"Missing Supabase credentials"**
   - Ensure `.env` file exists with correct values
   - For GitHub Actions, add repository secrets

2. **"Table not found"**
   - Verify your Supabase database has the required tables
   - Check table names match configuration

3. **"Rate limit exceeded"**
   - Increase `RATE_LIMIT_DELAY_MS` in `.env`
   - Reduce `MAX_CONCURRENT_REQUESTS`

4. **PDF processing fails**
   - Ensure Python 3.8+ is installed
   - Install Python dependencies: `pip install -r scripts/python/requirements.txt`

### Debug Mode

Enable verbose logging:
```bash
LOG_LEVEL=debug npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Adding New Data Sources

To add support for new data sources:

1. Add URL patterns to `src/modules/Discovery.ts`
2. Implement scraping logic in `src/modules/Scraper.ts`
3. Update scoring algorithm if needed
4. Test thoroughly with sample data

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- Powered by [Supabase](https://supabase.com)
- Uses [Cheerio](https://cheerio.js.org/) for HTML parsing
- PDF processing with [pdfplumber](https://github.com/jsvine/pdfplumber)

---

Built with 💚 by HempQuarterz