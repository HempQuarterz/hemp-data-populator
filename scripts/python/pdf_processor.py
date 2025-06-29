#!/usr/bin/env python3
"""
PDF Processor for Hemp Data Populator
Extracts hemp product data from PDF files
"""

import sys
import json
import re
from typing import List, Dict, Any

try:
    import pdfplumber
except ImportError:
    print("Error: pdfplumber not installed. Run: pip install pdfplumber", file=sys.stderr)
    sys.exit(1)


class PDFProcessor:
    def __init__(self):
        self.hemp_keywords = [
            'hemp', 'fiber', 'fibre', 'seed', 'oil', 'cbd', 'cannabinoid',
            'industrial hemp', 'cannabis sativa', 'hempseed', 'hemp-based'
        ]
        
        self.plant_parts = {
            'seed': ['seed', 'grain', 'kernel'],
            'fiber': ['fiber', 'fibre', 'bast', 'textile'],
            'flower': ['flower', 'bud', 'inflorescence'],
            'leaf': ['leaf', 'leaves', 'foliage'],
            'root': ['root', 'rhizome'],
            'stem': ['stem', 'stalk', 'hurd', 'shiv']
        }
        
        self.industries = {
            'Food & Nutrition': ['food', 'nutrition', 'dietary', 'supplement', 'protein'],
            'Textiles': ['textile', 'fabric', 'clothing', 'apparel', 'fashion'],
            'Construction': ['construction', 'building', 'insulation', 'concrete', 'hempcrete'],
            'Automotive': ['automotive', 'car', 'vehicle', 'automobile'],
            'Cosmetics': ['cosmetic', 'beauty', 'skincare', 'personal care'],
            'Pharmaceutical': ['pharmaceutical', 'medicine', 'drug', 'therapy'],
            'Paper': ['paper', 'pulp', 'cardboard'],
            'Bioplastics': ['plastic', 'bioplastic', 'polymer', 'composite'],
            'Energy': ['energy', 'fuel', 'biofuel', 'biomass']
        }

    def extract_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """Extract hemp products from PDF file"""
        products = []
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    # Extract text
                    text = page.extract_text()
                    if not text:
                        continue
                    
                    # Extract tables
                    tables = page.extract_tables()
                    
                    # Process text
                    text_products = self._extract_from_text(text, pdf_path)
                    products.extend(text_products)
                    
                    # Process tables
                    for table in tables:
                        table_products = self._extract_from_table(table, pdf_path)
                        products.extend(table_products)
        
        except Exception as e:
            print(f"Error processing PDF: {e}", file=sys.stderr)
        
        return self._deduplicate(products)
    
    def _extract_from_text(self, text: str, source_url: str) -> List[Dict[str, Any]]:
        """Extract products from plain text"""
        products = []
        
        # Split into sentences
        sentences = re.split(r'[.!?\n]+', text)
        
        for sentence in sentences:
            if any(keyword in sentence.lower() for keyword in self.hemp_keywords):
                product = self._parse_sentence(sentence, source_url)
                if product:
                    products.append(product)
        
        return products
    
    def _extract_from_table(self, table: List[List[str]], source_url: str) -> List[Dict[str, Any]]:
        """Extract products from table data"""
        products = []
        
        if not table or len(table) < 2:
            return products
        
        # Assume first row is header
        headers = [str(h).lower() if h else '' for h in table[0]]
        
        # Find relevant columns
        name_col = self._find_column(headers, ['product', 'name', 'item', 'use'])
        desc_col = self._find_column(headers, ['description', 'details', 'application'])
        part_col = self._find_column(headers, ['part', 'component', 'source'])
        industry_col = self._find_column(headers, ['industry', 'sector', 'category'])
        
        # Extract data rows
        for row in table[1:]:
            if name_col is not None and name_col < len(row) and row[name_col]:
                product = {
                    'product_name': str(row[name_col]).strip(),
                    'description': str(row[desc_col]) if desc_col is not None and desc_col < len(row) else '',
                    'plant_part': self._extract_plant_part(str(row[part_col]) if part_col is not None and part_col < len(row) else ''),
                    'industry': self._extract_industry(str(row[industry_col]) if industry_col is not None and industry_col < len(row) else ''),
                    'source_url': source_url
                }
                
                # Only add if it's hemp-related
                if self._is_hemp_product(product['product_name'] + ' ' + product['description']):
                    products.append(product)
        
        return products
    
    def _parse_sentence(self, sentence: str, source_url: str) -> Dict[str, Any] or None:
        """Parse a sentence to extract product information"""
        sentence = sentence.strip()
        if len(sentence) < 10:
            return None
        
        # Try to extract product name and description
        # Look for patterns like "X is used for Y" or "X: Y"
        patterns = [
            r'([^,]+?)\s+(?:is used for|can be used for|used in)\s+(.+)',
            r'([^:]+):\s*(.+)',
            r'([^-]+)\s*[-–—]\s*(.+)'
        ]
        
        for pattern in patterns:
            match = re.match(pattern, sentence, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                description = match.group(2).strip()
                
                return {
                    'product_name': name,
                    'description': description,
                    'plant_part': self._extract_plant_part(sentence),
                    'industry': self._extract_industry(sentence),
                    'source_url': source_url
                }
        
        # If no pattern matches, use the whole sentence
        return {
            'product_name': sentence[:50] + '...' if len(sentence) > 50 else sentence,
            'description': sentence,
            'plant_part': self._extract_plant_part(sentence),
            'industry': self._extract_industry(sentence),
            'source_url': source_url
        }
    
    def _is_hemp_product(self, text: str) -> bool:
        """Check if text describes a hemp product"""
        return any(keyword in text.lower() for keyword in self.hemp_keywords)
    
    def _extract_plant_part(self, text: str) -> str:
        """Extract plant part from text"""
        text_lower = text.lower()
        
        for part, keywords in self.plant_parts.items():
            if any(keyword in text_lower for keyword in keywords):
                return part
        
        return 'unspecified'
    
    def _extract_industry(self, text: str) -> str:
        """Extract industry from text"""
        text_lower = text.lower()
        
        for industry, keywords in self.industries.items():
            if any(keyword in text_lower for keyword in keywords):
                return industry
        
        return 'Other'
    
    def _find_column(self, headers: List[str], keywords: List[str]) -> int or None:
        """Find column index by keywords"""
        for i, header in enumerate(headers):
            if any(keyword in header for keyword in keywords):
                return i
        return None
    
    def _deduplicate(self, products: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate products"""
        seen = set()
        unique = []
        
        for product in products:
            key = f"{product['product_name']}|{product['plant_part']}|{product['industry']}".lower()
            if key not in seen:
                seen.add(key)
                unique.append(product)
        
        return unique


def main():
    """Main entry point for the script"""
    if len(sys.argv) != 2:
        print("Usage: python pdf_processor.py <pdf_file>", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    processor = PDFProcessor()
    
    try:
        products = processor.extract_from_pdf(pdf_path)
        # Output as JSON to stdout
        print(json.dumps(products, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()