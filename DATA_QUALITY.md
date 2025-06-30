# Data Quality Protection Guide

## Overview
This Hemp Data Populator includes multiple layers of protection against junk data to ensure only high-quality hemp product information enters your database.

## Protection Layers

### 1. **Source Validation** (Pre-Scraping)
- Blacklisted domains that have proven problematic
- Trusted domain whitelist for reliable sources
- Preview validation for CSV/JSON files
- Quality scoring based on content preview

### 2. **Data Processing Validation**
- Numeric name detection and rejection
- Minimum name length requirements (3+ characters)
- Hemp-related keyword verification
- Valid plant part enforcement
- Industry validation (no "Other" or numeric values)

### 3. **Database Constraints**
- CHECK constraints prevent numeric names
- Minimum length requirements enforced
- Trigger validates hemp-related content
- Foreign key constraints maintain data integrity

### 4. **Post-Processing Validation**
- Batch validation before database insertion
- Quality scoring for each product
- Automatic rejection of suspicious batches

## Running Quality Checks

### Monitor Data Quality
```bash
npm run quality
```

### Auto-Clean Junk Data
```bash
npm run quality:clean
```

### View Statistics
```bash
npm run monitor
```

## Configuration

Edit `quality-rules.json` to customize:
- Minimum/maximum lengths
- Forbidden patterns
- Required keywords
- Allowed plant parts
- Trusted/blacklisted domains

## Maintenance Schedule

### Daily
- Run `npm run quality` to check data health
- Review any alerts or warnings

### Weekly
- Run `npm run quality:clean` to remove any junk
- Update blacklisted domains if new bad sources found

### Monthly
- Review and update quality rules
- Analyze rejected data to improve validation

## Common Issues and Solutions

### Problem: Numeric entries appearing
**Solution**: 
1. Check source validator blacklist
2. Run `npm run quality:clean`
3. Add source to blacklist if recurring

### Problem: Low-quality descriptions
**Solution**:
1. Improve scraping selectors
2. Add minimum description length rules
3. Require descriptions for short product names

### Problem: Invalid plant parts
**Solution**:
1. Update allowed plant parts list
2. Add normalization rules
3. Map common variations to standard terms

## Emergency Cleanup

If junk data gets through:

1. **Immediate Action**:
   ```sql
   -- In Supabase SQL editor
   DELETE FROM hemp_automation_products 
   WHERE name ~ '^\d+$' OR plant_part ~ '^\d+$';
   ```

2. **Find the Source**:
   ```bash
   npm run quality
   ```

3. **Prevent Recurrence**:
   - Add source to blacklist
   - Update validation rules
   - Run full harvest with new rules

## Best Practices

1. **Always preview new sources** before adding to discovery
2. **Test with small batches** when adding new scrapers
3. **Monitor after each harvest** for quality issues
4. **Keep blacklist updated** with problematic sources
5. **Document any manual interventions** for future reference
