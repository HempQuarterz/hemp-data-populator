#!/usr/bin/env node

// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Now import everything else
import { Command } from 'commander';
import { DataHarvester } from './core/DataHarvester';
import { logger } from './utils/logger';
import { RunMode } from './types';

const program = new Command();

program
  .name('hemp-data-populator')
  .description('Autonomous data harvester for industrial hemp uses and products')
  .version('1.0.0');

program
  .option('-m, --mode <mode>', 'Run mode: once, schedule, or trigger', 'once')
  .option('-u, --urls <urls>', 'Comma-separated URLs for trigger mode')
  .option('-c, --cron <expression>', 'Cron expression for schedule mode', '0 2 * * *') // Daily at 2 AM
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    logger.info('🌱 Hemp Data Populator starting...', {
      mode: options.mode,
      urls: options.urls,
      cron: options.cron
    });

    // Validate environment
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase credentials. Please check your .env file.');
    }

    const harvester = new DataHarvester();

    switch (options.mode as RunMode) {
      case 'once':
        await harvester.runOnce();
        break;
      
      case 'trigger':
        if (!options.urls) {
          throw new Error('URLs required for trigger mode. Use --urls flag.');
        }
        const urls = options.urls.split(',').map((url: string) => url.trim());
        await harvester.runTrigger(urls);
        break;
      
      case 'schedule':
        logger.info(`Scheduling runs with cron: ${options.cron}`);
        await harvester.runSchedule(options.cron);
        break;
      
      default:
        throw new Error(`Invalid mode: ${options.mode}`);
    }
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

main();