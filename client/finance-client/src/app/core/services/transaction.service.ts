import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Transaction } from '../models/transaction.model';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  private apiUrl = `${environment.apiBaseUrl}/api/transactions`;
  
  // Signal to store all transactions
  private _transactions = signal<Transaction[]>([]);
  public transactions = this._transactions.asReadonly();
  
  // Loading state
  private _loading = signal<boolean>(false);
  public loading = this._loading.asReadonly();

  // Flag to prevent duplicate loading of all transactions
  private isLoadingAllTransactions = false;
  private hasLoadedAllTransactions = false;
  private currentUserId: number | null = null;

  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) {}

  private normalizeTransaction(transaction: Transaction): Transaction {
    // Map transactionDate to date for backward compatibility
    if (transaction.transactionDate && !transaction.date) {
      transaction.date = transaction.transactionDate;
    }
    // If date exists but transactionDate doesn't, map it back
    if (transaction.date && !transaction.transactionDate) {
      transaction.transactionDate = transaction.date;
    }
    // Map isHalves (lowercase from JSON) to IsHalves (PascalCase) for consistency
    // Handle both cases: when backend sends isHalves (camelCase) or IsHalves (PascalCase)
    const txAny = transaction as any;
    if (txAny.isHalves !== undefined && transaction.IsHalves === undefined) {
      transaction.IsHalves = Boolean(txAny.isHalves);
    } else if (txAny.IsHalves !== undefined) {
      transaction.IsHalves = Boolean(txAny.IsHalves);
    }
    // Ensure assignedMonthDate is preserved as-is (don't convert to Date object if it's a string)
    // The backend sends it as a string, and we want to keep it that way for filtering
    // Don't auto-set billingDate - let it be undefined if not provided
    // The backend should always send billingDate, even if it equals transactionDate
    return transaction;
  }

  getTransactions(startDate?: Date, endDate?: Date, categoryId?: number, type?: string, replaceInRange: boolean = false): Observable<Transaction[]> {
    this._loading.set(true);
    let params = new HttpParams();
    
    if (startDate) {
      params = params.set('startDate', startDate.toISOString());
    }
    if (endDate) {
      params = params.set('endDate', endDate.toISOString());
    }
    if (categoryId) {
      params = params.set('categoryId', categoryId.toString());
    }
    if (type) {
      params = params.set('type', type);
    }

    return this.http.get<Transaction[]>(this.apiUrl, { params }).pipe(
      tap({
        next: (transactions) => {
          // Normalize transactions (map transactionDate to date for backward compatibility)
          const normalizedTransactions = (transactions || []).map(t => this.normalizeTransaction(t));
          
          // Get current user ID from token to detect user changes
          const token = localStorage.getItem('token');
          let userId: number | null = null;
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              userId = payload.nameid ? parseInt(payload.nameid) : null;
            } catch (e) {
              // Invalid token, ignore
            }
          }
          
          // If user changed, replace all transactions. Otherwise merge to support incremental loading
          if (userId !== null && userId !== this.currentUserId) {
            // User changed - replace all transactions
            this.currentUserId = userId;
            this._transactions.set(normalizedTransactions);
          } else if (replaceInRange && (startDate || endDate)) {
            // Replace transactions in the specified date range
            // Use assignedMonthDate for comparison (this is what the backend uses for filtering)
            // Compare by year and month only (like the backend does)
            this._transactions.update(existing => {
              // Normalize dates to first day of month for comparison (use UTC for consistency)
              const normalizeToMonth = (date: Date): Date => {
                return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
              };
              
              // Extract target month from startDate (it represents the selected month)
              // For month-10th, startDate is on the 10th, but we want the month itself
              const targetYear = startDate ? startDate.getUTCFullYear() : null;
              const targetMonthIndex = startDate ? startDate.getUTCMonth() : null;
              
              // Filter out transactions that are in the date range (based on assignedMonthDate)
              const filtered = existing.filter(t => {
                const assignedMonthDate = t.assignedMonthDate;
                if (!assignedMonthDate) {
                  // If no assignedMonthDate, fall back to transactionDate and use date range comparison
                  const transactionDate = t.transactionDate || t.date;
                  if (!transactionDate) return true; // Keep transactions without dates
                  const date = normalizeToMonth(new Date(transactionDate));
                  const startMonth = startDate ? normalizeToMonth(startDate) : null;
                  const endMonth = endDate ? normalizeToMonth(endDate) : null;
                  const inRange = (!startMonth || date >= startMonth) && (!endMonth || date <= endMonth);
                  return !inRange; // Keep transactions outside the range
                }
                
                // For assignedMonthDate, compare by month only (not by date range)
                // This is because assignedMonthDate represents the month the transaction belongs to
                if (targetYear !== null && targetMonthIndex !== null) {
                  // Parse assignedMonthDate - handle both Date and string formats
                  let assignedDate: Date;
                  if (assignedMonthDate instanceof Date) {
                    assignedDate = assignedMonthDate;
                  } else if (typeof assignedMonthDate === 'string') {
                    // Parse string as UTC: "2025-11-01T00:00:00" -> UTC date
                    const dateStr = assignedMonthDate.trim();
                    if (dateStr.endsWith('Z')) {
                      assignedDate = new Date(dateStr);
                    } else {
                      // Parse manually: "2025-11-01T00:00:00" -> UTC
                      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                      if (match) {
                        const year = parseInt(match[1], 10);
                        const month = parseInt(match[2], 10) - 1; // 0-indexed
                        const day = parseInt(match[3], 10);
                        assignedDate = new Date(Date.UTC(year, month, day));
                      } else {
                        assignedDate = new Date(dateStr);
                      }
                    }
                  } else {
                    assignedDate = new Date(String(assignedMonthDate));
                  }
                  
                  if (isNaN(assignedDate.getTime())) {
                    // Invalid date, keep the transaction
                    this.logger.debug('[TRANSACTION] Keeping transaction (invalid date)', {
                      id: t.id,
                      merchantName: t.merchantName,
                      assignedMonthDate: assignedMonthDate
                    });
                    return true;
                  }
                  
                  const assignedYear = assignedDate.getUTCFullYear();
                  const assignedMonth = assignedDate.getUTCMonth();
                  
                  // Keep transactions that are NOT in the target month
                  const shouldKeep = !(assignedYear === targetYear && assignedMonth === targetMonthIndex);
                  
                  return shouldKeep;
                }
                
                // Fallback: use date range comparison
                const date = normalizeToMonth(new Date(assignedMonthDate));
                const startMonth = startDate ? normalizeToMonth(startDate) : null;
                const endMonth = endDate ? normalizeToMonth(endDate) : null;
                const inRange = (!startMonth || date >= startMonth) && (!endMonth || date <= endMonth);
                return !inRange; // Keep transactions outside the range
              });
              
              // Add new transactions from server
              // Use Map to prevent duplicates by ID
              const transactionMap = new Map<number, Transaction>();
              
              // First add filtered existing transactions
              filtered.forEach(t => transactionMap.set(t.id, t));
              
              // Then add/update with new transactions from server
              normalizedTransactions.forEach(t => transactionMap.set(t.id, t));
              
              return Array.from(transactionMap.values());
            });
          } else {
            // Same user - merge new transactions with existing ones
            this._transactions.update(existing => {
              const transactionMap = new Map<number, Transaction>();
              
              // Add existing transactions to map
              existing.forEach(t => transactionMap.set(t.id, t));
              
              // Update/add new transactions
              normalizedTransactions.forEach(t => transactionMap.set(t.id, t));
              
              // Convert back to array
              return Array.from(transactionMap.values());
            });
          }
          this._loading.set(false);
        },
        error: () => {
          this._loading.set(false);
        }
      })
    );
  }

  getTransactionById(id: number): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.apiUrl}/${id}`).pipe(
      tap(transaction => this.normalizeTransaction(transaction))
    );
  }

  createTransaction(transaction: Partial<Transaction>): Observable<Transaction> {
    this.logger.log('[TRANSACTION] Creating transaction', { 
      type: transaction.type, 
      amount: transaction.amount, 
      merchantName: transaction.merchantName 
    });
    
    // Map date to transactionDate if needed
    const payload: any = { ...transaction };
    if (payload.date && !payload.transactionDate) {
      payload.transactionDate = payload.date;
      payload.billingDate = payload.date;
    }
    
    return this.http.post<Transaction>(this.apiUrl, payload).pipe(
      tap({
        next: (newTransaction) => {
          this.logger.log('[TRANSACTION] Transaction created successfully', { 
            id: newTransaction.id, 
            type: newTransaction.type, 
            amount: newTransaction.amount 
          });
          const normalized = this.normalizeTransaction(newTransaction);
          // Add new transaction to the signal
          this._transactions.update(transactions => {
            // Check if transaction already exists (avoid duplicates)
            const exists = transactions.some(t => t.id === normalized.id);
            if (exists) {
              return transactions.map(t => t.id === normalized.id ? normalized : t);
            }
            return [...transactions, normalized];
          });
        },
        error: (error) => {
          this.logger.error('[TRANSACTION] Failed to create transaction', error, { 
            type: transaction.type, 
            amount: transaction.amount, 
            error: error?.error?.message || error?.message,
            status: error?.status 
          });
        }
      })
    );
  }

  updateTransaction(id: number, transaction: Partial<Transaction>): Observable<Transaction> {
    this.logger.log('[TRANSACTION] Updating transaction', { 
      id, 
      type: transaction.type, 
      amount: transaction.amount 
    });
    
    // Map date to transactionDate if needed
    const payload: any = { ...transaction };
    if (payload.date && !payload.transactionDate) {
      payload.transactionDate = payload.date;
      if (!payload.billingDate) {
        payload.billingDate = payload.date;
      }
    }
    
    // Always remove assignedMonthDate from payload - let server preserve existing value
    // assignedMonthDate should not be updated through the edit dialog (similar to is-halves endpoint)
    delete payload.assignedMonthDate;
    
    return this.http.put<Transaction>(`${this.apiUrl}/${id}`, payload).pipe(
      tap({
        next: (updatedTransaction) => {
          this.logger.log('[TRANSACTION] Transaction updated successfully', { 
            id: updatedTransaction.id, 
            type: updatedTransaction.type 
          });
          const normalized = this.normalizeTransaction(updatedTransaction);
          // Update transaction in the signal - replace if exists, add if not
          this._transactions.update(transactions => {
            const existingIndex = transactions.findIndex(t => t.id === id);
            if (existingIndex >= 0) {
              // Replace existing transaction
              return transactions.map(t => t.id === id ? normalized : t);
            } else {
              // Add new transaction if it doesn't exist (might be outside current date range)
              return [...transactions, normalized];
            }
          });
        },
        error: (error) => {
          this.logger.error('[TRANSACTION] Failed to update transaction', error, { 
            id, 
            error: error?.error?.message || error?.message,
            status: error?.status 
          });
        }
      })
    );
  }

  deleteTransaction(id: number): Observable<void> {
    this.logger.log('[TRANSACTION] Deleting transaction', { id });
    
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap({
        next: () => {
          this.logger.log('[TRANSACTION] Transaction deleted successfully', { id });
          // Remove transaction from the signal
          this._transactions.update(transactions =>
            transactions.filter(t => t.id !== id)
          );
        },
        error: (error) => {
          this.logger.error('[TRANSACTION] Failed to delete transaction', error, { 
            id, 
            error: error?.error?.message || error?.message,
            status: error?.status 
          });
        }
      })
    );
  }

  // Method to refresh transactions (replaces transactions in date range)
  refreshTransactions(startDate?: Date, endDate?: Date, categoryId?: number, type?: string): Observable<Transaction[]> {
    return this.getTransactions(startDate, endDate, categoryId, type, true);
  }

  // Get available months from transactions - as computed signal for reactivity
  // Uses UTC to be consistent with month-selector component
  availableMonths = computed(() => {
    const transactions = this._transactions();
    const monthSet = new Set<string>();
    
    transactions.forEach(t => {
      const dateValue = t?.date || t?.transactionDate;
      if (t && dateValue) {
        const date = new Date(dateValue);
        // Use UTC to be consistent with month-selector component
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth(); // 0-11
        const monthKey = `${year}-${month}`;
        monthSet.add(monthKey);
      }
    });
    
    // Convert to Date array and sort descending (newest first)
    // Use UTC dates for consistency
    const months = Array.from(monthSet).map(key => {
      const [year, month] = key.split('-').map(Number);
      return new Date(Date.UTC(year, month, 1));
    });
    
    return months.sort((a, b) => b.getTime() - a.getTime());
  });

  // Load all transactions (without date filter) to get available months
  loadAllTransactionsForMonths(): void {
    // Prevent duplicate calls if already loading or recently loaded
    if (this.isLoadingAllTransactions) {
      return;
    }

    // If we already have transactions loaded, skip (they will be refreshed when needed)
    // Only load if we have no transactions at all
    if (this.hasLoadedAllTransactions && this._transactions().length > 0) {
      return;
    }

    this.isLoadingAllTransactions = true;
    
    // Load all transactions without date filter to populate available months
    this.getTransactions().subscribe({
      next: () => {
        // Transactions loaded, availableMonths will update automatically
        this.hasLoadedAllTransactions = true;
        this.isLoadingAllTransactions = false;
      },
      error: (error) => {
        this.logger.error('Error loading all transactions for months', error);
        this.isLoadingAllTransactions = false;
      }
    });
  }

  uploadTransactionsFile(file: File, year?: number, month?: number): Observable<{ message: string; totalParsed: number; totalCreated: number; transactions: Transaction[] }> {
    this.logger.log('[TRANSACTION] Uploading transactions file', { 
      fileName: file.name, 
      fileSize: file.size, 
      year, 
      month 
    });
    
    this._loading.set(true);
    const formData = new FormData();
    formData.append('file', file);

    // Build URL with optional year/month parameters
    let url = `${this.apiUrl}/upload`;
    if (year !== undefined && month !== undefined) {
      url += `?year=${year}&month=${month}`;
    }

    return this.http.post<{ message: string; totalParsed: number; totalCreated: number; transactions: Transaction[] }>(
      url,
      formData
    ).pipe(
      tap({
        next: (response) => {
          this.logger.log('[TRANSACTION] File upload successful', { 
            fileName: file.name, 
            totalParsed: response.totalParsed, 
            totalCreated: response.totalCreated 
          });
          
          // Don't update signal here - will reload from server instead
          this._loading.set(false);
        },
        error: (error) => {
          this.logger.error('[TRANSACTION] File upload failed', error, { 
            fileName: file.name, 
            error: error?.error?.message || error?.message,
            status: error?.status 
          });
          this._loading.set(false);
        }
      })
    );
  }

  uploadTransactionsJson(transactions: Partial<Transaction>[], year: number, month: number): Observable<{ message: string; totalParsed: number; totalCreated: number; transactions: Transaction[] }> {
    this.logger.log('[TRANSACTION] Uploading transactions JSON', { 
      transactionCount: transactions.length, 
      year, 
      month 
    });
    
    this._loading.set(true);

    return this.http.post<{ message: string; totalParsed: number; totalCreated: number; transactions: Transaction[] }>(
      `${this.apiUrl}/upload-json?year=${year}&month=${month}`,
      transactions
    ).pipe(
      tap({
        next: (response) => {
          this.logger.log('[TRANSACTION] JSON upload successful', { 
            totalParsed: response.totalParsed, 
            totalCreated: response.totalCreated 
          });
          
          // Don't update signal here - will reload from server instead
          this._loading.set(false);
        },
        error: (error) => {
          this.logger.error('[TRANSACTION] JSON upload failed', error, { 
            transactionCount: transactions.length, 
            error: error?.error?.message || error?.message,
            status: error?.status 
          });
          this._loading.set(false);
        }
      })
    );
  }

  updateIsHalves(id: number, isHalves: boolean): Observable<Transaction> {
    this.logger.log('[TRANSACTION] Updating IsHalves', { id, isHalves });
    
    return this.http.patch<Transaction>(`${this.apiUrl}/${id}/is-halves`, { isHalves }).pipe(
      tap({
        next: (updatedTransaction) => {
          this.logger.log('[TRANSACTION] IsHalves updated successfully', { 
            id: updatedTransaction.id, 
            isHalves: updatedTransaction.IsHalves 
          });
          const normalized = this.normalizeTransaction(updatedTransaction);
          // Update transaction in the signal - replace if exists, add if not
          this._transactions.update(transactions => {
            const existingIndex = transactions.findIndex(t => t.id === id);
            if (existingIndex >= 0) {
              // Replace existing transaction
              return transactions.map(t => t.id === id ? normalized : t);
            } else {
              // Add new transaction if it doesn't exist (might be outside current date range)
              return [...transactions, normalized];
            }
          });
        },
        error: (error) => {
          this.logger.error('[TRANSACTION] Failed to update IsHalves', error, { 
            id, 
            error: error?.error?.message || error?.message,
            status: error?.status 
          });
        }
      })
    );
  }

  // Clear all cached transactions (called on logout or user change)
  clearCache(): void {
    this._transactions.set([]);
    this.currentUserId = null;
    this.isLoadingAllTransactions = false;
    this.hasLoadedAllTransactions = false;
  }
}

