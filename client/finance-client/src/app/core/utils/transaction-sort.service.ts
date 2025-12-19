import { Injectable } from '@angular/core';
import { Transaction } from '../models/transaction.model';

/**
 * Service for sorting transactions
 * Extracted from TransactionListComponent to improve maintainability
 */
@Injectable({
  providedIn: 'root'
})
export class TransactionSortService {
  
  /**
   * Sort transactions by column and direction
   */
  sortTransactions(
    transactions: Transaction[],
    sortColumn: string,
    sortDirection: 'asc' | 'desc'
  ): Transaction[] {
    if (!transactions || transactions.length === 0) {
      return transactions;
    }

    const sorted = [...transactions];
    const sortDir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      let comparison = 0;
      const sortCol = sortColumn;

      switch (sortCol) {
        case 'date':
        case 'transactionDate':
          const dateA = new Date(a.transactionDate || a.date || 0).getTime();
          const dateB = new Date(b.transactionDate || b.date || 0).getTime();
          comparison = dateA - dateB;
          break;
        case 'billingDate':
          const billingDateA = new Date(a.billingDate || a.transactionDate || a.date || 0).getTime();
          const billingDateB = new Date(b.billingDate || b.transactionDate || b.date || 0).getTime();
          comparison = billingDateA - billingDateB;
          break;
        case 'assignedMonthDate':
          const assignedA = new Date(a.assignedMonthDate || a.transactionDate || a.date || 0).getTime();
          const assignedB = new Date(b.assignedMonthDate || b.transactionDate || b.date || 0).getTime();
          comparison = assignedA - assignedB;
          break;
        case 'merchantName':
          const merchantA = (a.merchantName || '').toLowerCase();
          const merchantB = (b.merchantName || '').toLowerCase();
          comparison = merchantA.localeCompare(merchantB, 'he');
          break;
        case 'amount':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
        case 'currency':
          const currencyA = (a.currency || '').toLowerCase();
          const currencyB = (b.currency || '').toLowerCase();
          comparison = currencyA.localeCompare(currencyB);
          break;
        case 'category':
        case 'categoryName':
          const categoryA = (a.categoryName || 'ללא קטגוריה').toLowerCase();
          const categoryB = (b.categoryName || 'ללא קטגוריה').toLowerCase();
          comparison = categoryA.localeCompare(categoryB, 'he');
          break;
        case 'referenceNumber':
          const refA = (a.referenceNumber || '').toLowerCase();
          const refB = (b.referenceNumber || '').toLowerCase();
          comparison = refA.localeCompare(refB);
          break;
        case 'source':
          const sourceA = (a.source || '').toLowerCase();
          const sourceB = (b.source || '').toLowerCase();
          comparison = sourceA.localeCompare(sourceB, 'he');
          break;
        case 'notes':
          const notesA = (a.notes || '').toLowerCase();
          const notesB = (b.notes || '').toLowerCase();
          comparison = notesA.localeCompare(notesB, 'he');
          break;
        case 'cardNumber':
          const cardA = (a.cardNumber || '').toLowerCase();
          const cardB = (b.cardNumber || '').toLowerCase();
          comparison = cardA.localeCompare(cardB);
          break;
        case 'branch':
          const branchA = (a.branch || '').toLowerCase();
          const branchB = (b.branch || '').toLowerCase();
          comparison = branchA.localeCompare(branchB, 'he');
          break;
        case 'installments':
          comparison = (a.installments || 0) - (b.installments || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDir === 1 ? comparison : -comparison;
    });

    return sorted;
  }
}

