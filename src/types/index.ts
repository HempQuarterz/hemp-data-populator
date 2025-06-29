export type RunMode = 'once' | 'schedule' | 'trigger';

export interface HempProduct {
  product_name: string;
  plant_part: string;
  industry: string;
  description: string;
  source_url: string;
  benefits?: string[];
  technical_specs?: Record<string, any>;
  sustainability_aspects?: string[];
  keywords?: string[];
}

export interface ScrapeResult {
  products: HempProduct[];
  source: string;
  scraped_at: Date;
  total_found: number;
  errors?: string[];
}

export interface HarvestRunResult {
  products_found: number;
  products_saved: number;
  companies_saved: number;
  duplicates_skipped: number;
  errors: string[];
  duration_ms: number;
}

export interface DataSource {
  url: string;
  type: 'html' | 'csv' | 'json' | 'pdf';
  score: number;
  size_estimate?: number;
  license?: string;
  last_updated?: Date;
}

export interface ScrapingOptions {
  rateLimit?: number;
  maxConcurrent?: number;
  userAgent?: string;
  timeout?: number;
}