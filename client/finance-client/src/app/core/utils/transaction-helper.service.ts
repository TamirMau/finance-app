import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';

/**
 * Shared utility service for transaction-related operations
 * Used across components to avoid code duplication
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionHelperService {
  
  /**
   * Safely parse transaction amount to number
   * Handles both number and string types, with fallback to 0
   */
  parseAmount(amount: number | string | null | undefined): number {
    if (amount === null || amount === undefined) {
      return 0;
    }
    if (typeof amount === 'number') {
      return amount;
    }
    return parseFloat(String(amount)) || 0;
  }

  /**
   * Calculate total amount for transactions of a specific type
   */
  calculateTotalByType(transactions: Transaction[], type: 'Income' | 'Expense'): number {
    if (!transactions || transactions.length === 0) {
      return 0;
    }
    return transactions
      .filter(t => t && t.type && t.type.toLowerCase() === type.toLowerCase())
      .reduce((sum, t) => {
        return sum + this.parseAmount(t.amount);
      }, 0);
  }

  /**
   * Filter transactions by type
   */
  filterByType(transactions: Transaction[], type: 'Income' | 'Expense'): Transaction[] {
    if (!transactions) {
      return [];
    }
    return transactions.filter(t => 
      t && t.type && t.type.toLowerCase() === type.toLowerCase()
    );
  }
}

