import { Injectable } from '@angular/core';
import { Category } from '../models/category.model';

/**
 * Service for formatting transaction display data
 * Extracted from TransactionListComponent to improve maintainability
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionFormatterService {
  
  /**
   * Get category icon by category ID
   */
  getCategoryIcon(categoryId: number, categories: Category[]): string | null {
    const category = categories.find(c => c.id === categoryId);
    return category?.icon || null;
  }

  /**
   * Get category color by category ID
   * Returns a soft color if category not found or has default color
   */
  getCategoryColor(categoryId: number, categories: Category[]): string {
    const category = categories.find(c => c.id === categoryId);
    
    // If category not found or color is missing/default, return a soft color from the palette
    if (!category || !category.color || 
        category.color === '#9CA3AF' || 
        category.color === '#2196F3' || 
        category.color === '#000000') {
      // Return a soft color based on categoryId hash
      const softColors = [
        '#93C5FD', // Soft Blue
        '#86EFAC', // Soft Green
        '#FCD34D', // Soft Amber
        '#FCA5A5', // Soft Red
        '#C4B5FD', // Soft Purple
        '#F9A8D4', // Soft Pink
        '#7DD3FC', // Soft Cyan
        '#FDB68A', // Soft Orange
        '#BEF264', // Soft Lime
        '#5EEAD4', // Soft Teal
        '#A5B4FC', // Soft Indigo
        '#D8B4FE', // Soft Violet
        '#6EE7B7', // Soft Emerald
        '#FBCFE8', // Soft Rose
        '#7DD3FC', // Soft Sky
        '#94A3B8', // Soft Slate
        '#E9D5FF', // Soft Fuchsia
        '#FDE68A', // Soft Yellow
        '#6EE7B7'  // Soft Mint
      ];
      
      const colorIndex = categoryId % softColors.length;
      return softColors[colorIndex];
    }
    
    return category.color;
  }

  /**
   * Get currency symbol by currency code
   */
  getCurrencySymbol(currency?: string): string {
    if (!currency) {
      return '₪';
    }
    
    const upperCurrency = currency.toUpperCase();
    switch (upperCurrency) {
      case 'ILS':
      case 'NIS':
      case '₪':
        return '₪';
      case 'USD':
      case '$':
        return '$';
      case 'EUR':
      case '€':
        return '€';
      case 'GBP':
      case '£':
        return '£';
      default:
        return currency;
    }
  }
}

