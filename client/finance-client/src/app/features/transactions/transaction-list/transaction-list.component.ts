import { Component, OnInit, OnDestroy, computed, effect, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { TransactionService } from '../../../core/services/transaction.service';
import { UserSettingsService } from '../../../core/services/user-settings.service';
import { CategoryService } from '../../../core/services/category.service';
import { Transaction } from '../../../core/models/transaction.model';
import { Category } from '../../../core/models/category.model';
import { MonthSelectorComponent } from '../../../shared/components/month-selector/month-selector.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import * as XLSX from 'xlsx';
import { ExpenseFormComponent } from '../expense-form/expense-form.component';
import { IncomeFormComponent } from '../income-form/income-form.component';
import { UploadResultsDialogComponent, UploadResultsData } from '../../../shared/components/upload-results-dialog/upload-results-dialog.component';
import { CardNumberHelperService } from '../../../core/utils/card-number-helper.service';
import { MonthYearExtractorService } from '../../../core/utils/month-year-extractor.service';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { LoggerService } from '../../../core/services/logger.service';
import { ExcelDateParserService } from '../../../core/utils/excel-date-parser.service';
import { TransactionSortService } from '../../../core/utils/transaction-sort.service';
import { TransactionFormatterService } from '../../../core/utils/transaction-formatter.service';
import { TransactionFiltersComponent } from '../../../shared/components/transaction-filters/transaction-filters.component';
import { TransactionEditDialogComponent, TransactionEditDialogData } from '../../../shared/components/transaction-edit-dialog/transaction-edit-dialog.component';

@Component({
  selector: 'app-transaction-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatCheckboxModule,
    MonthSelectorComponent,
    ReactiveFormsModule,
    ExpenseFormComponent,
    IncomeFormComponent,
    TransactionFiltersComponent
  ],
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class TransactionListComponent implements OnInit, OnDestroy {
  // Base columns without isHalves
  private baseExpenseColumns: string[] = ['date', 'billingDate', 'assignedMonthDate', 'merchantName', 'amount', 'currency', 'category', 'referenceNumber', 'installments', 'branch', 'cardNumber', 'source', 'notes', 'actions'];
  private baseIncomeColumns: string[] = ['date', 'billingDate', 'assignedMonthDate', 'merchantName', 'amount', 'currency', 'category', 'referenceNumber', 'source', 'notes', 'actions'];
  
  // Computed displayed columns based on showHalves setting
  displayedColumns = computed(() => {
    const showHalves = this.settingsService.showHalves();
    if (showHalves) {
      // Insert 'isHalves' before 'actions'
      const columns = [...this.baseExpenseColumns];
      const actionsIndex = columns.indexOf('actions');
      columns.splice(actionsIndex, 0, 'isHalves');
      return columns;
    }
    return this.baseExpenseColumns;
  });
  
  incomeDisplayedColumns: string[] = ['date', 'billingDate', 'assignedMonthDate', 'merchantName', 'amount', 'currency', 'category', 'referenceNumber', 'source', 'notes', 'actions'];
  
  // Search and filter signals
  searchTerm = signal<string>('');
  selectedCategoryFilter = signal<number | null>(null);
  sortColumn = signal<string>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');
  
  // Separate signals for incomes and expenses
  showIncomeForm = signal<boolean>(false);
  incomeFormLoading = signal<boolean>(false);
  
  showExpenseForm = signal<boolean>(false);
  expenseFormLoading = signal<boolean>(false);
  editingTransactionId = signal<number | null>(null);
  
  // Categories
  categories = signal<Category[]>([]);
  
  // Search subject for debouncing
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  // Store category name from query params to apply filter after categories load
  private pendingCategoryFilter: string | null = null;
  
  // Get date range from settings
  dateRange = computed(() => {
    const selectedMonth = this.settingsService.selectedMonth();
    return this.settingsService.getDateRange(selectedMonth || undefined);
  });
  
  // Filter transactions based on settings
  allFilteredTransactions = computed(() => {
    const all = this.transactionService.transactions();
    const { start, end } = this.dateRange();
    return this.settingsService.filterTransactionsByDateRange(all, start, end);
  });

  // Separate incomes and expenses
  allIncomes = computed(() => {
    return this.allFilteredTransactions().filter(t => t.type === 'Income');
  });
  
  allExpenses = computed(() => {
    return this.allFilteredTransactions().filter(t => t.type === 'Expense');
  });
  
  // Apply search and filters for incomes
  filteredIncomes = computed(() => {
    let filtered = [...this.allIncomes()];
    const search = this.searchTerm().toLowerCase().trim();
    const categoryFilter = this.selectedCategoryFilter();
    
    // Search filter
    if (search) {
      filtered = filtered.filter(t => {
        const categoryName = (t.categoryName || 'ללא קטגוריה').toLowerCase();
        const merchantName = (t.merchantName || '').toLowerCase();
        const source = (t.source || '').toLowerCase();
        const notes = (t.notes || '').toLowerCase();
        const amount = String(t.amount || '').toLowerCase();
        const cardNumber = (t.cardNumber || '').toLowerCase();
        return categoryName.includes(search) || 
               merchantName.includes(search) ||
               source.includes(search) || 
               notes.includes(search) ||
               amount.includes(search) ||
               cardNumber.includes(search);
      });
    }
    
    // Category filter
    if (categoryFilter !== null) {
      filtered = filtered.filter(t => t.categoryId === categoryFilter);
    }
    
    return this.sortService.sortTransactions(filtered, this.sortColumn(), this.sortDirection());
  });
  
  // Apply search and filters for expenses
  transactions = computed(() => {
    let filtered = [...this.allExpenses()];
    const search = this.searchTerm().toLowerCase().trim();
    const categoryFilter = this.selectedCategoryFilter();
    
    // Search filter
    if (search) {
      filtered = filtered.filter(t => {
        const categoryName = (t.categoryName || 'ללא קטגוריה').toLowerCase();
        const merchantName = (t.merchantName || '').toLowerCase();
        const source = (t.source || '').toLowerCase();
        const notes = (t.notes || '').toLowerCase();
        const amount = String(t.amount || '').toLowerCase();
        const cardNumber = (t.cardNumber || '').toLowerCase();
        return categoryName.includes(search) || 
               merchantName.includes(search) ||
               source.includes(search) || 
               notes.includes(search) ||
               amount.includes(search) ||
               cardNumber.includes(search);
      });
    }
    
    // Category filter
    if (categoryFilter !== null) {
      filtered = filtered.filter(t => t.categoryId === categoryFilter);
    }
    
    return this.sortService.sortTransactions(filtered, this.sortColumn(), this.sortDirection());
  });
  
  // Calculate total amount of expenses with IsHalves = true for current month
  halvesExpensesTotal = computed(() => {
    const expenses = this.allExpenses();
    return expenses
      .filter(t => t.IsHalves === true)
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  });
  
  // Calculate half of the total (total / 2)
  halvesExpensesHalf = computed(() => {
    return this.halvesExpensesTotal() / 2;
  });
  
  // Check if there are any expenses with IsHalves = true
  hasHalvesExpenses = computed(() => {
    const expenses = this.allExpenses();
    return expenses.some(t => t.IsHalves === true);
  });
  
  // Check if halves summary card should be displayed
  shouldShowHalvesSummary = computed(() => {
    return this.settingsService.showHalves() && this.hasHalvesExpenses();
  });
  
  loading = computed(() => this.transactionService.loading());

  private lastDateRange: { start: Date; end: Date } | null = null;
  private isInitialized = false;
  private isRefreshing = false; // Flag to prevent effect from running during refresh
  
  // Signal to track current transaction type from route
  private transactionTypeSignal = signal<'Income' | 'Expense'>('Expense');
  
  // Determine transaction type from route
  transactionType = computed(() => this.transactionTypeSignal());
  
  pageTitle = computed(() => {
    return this.transactionType() === 'Income' ? 'הכנסות' : 'הוצאות';
  });

  constructor(
    private transactionService: TransactionService,
    private settingsService: UserSettingsService,
    private categoryService: CategoryService,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private cardNumberHelper: CardNumberHelperService,
    private monthYearExtractor: MonthYearExtractorService,
    private confirmDialog: ConfirmDialogService,
    private logger: LoggerService,
    private excelDateParser: ExcelDateParserService,
    private sortService: TransactionSortService,
    private formatterService: TransactionFormatterService
  ) {
    
    // Effect to reload transactions when settings or month changes
    // Skip during initial load to prevent duplicate calls
    effect(() => {
      if (!this.isInitialized || this.isRefreshing) {
        return; // Skip effect during initialization or when refreshing
      }
      
      const { start, end } = this.dateRange();
      // Only reload if date range actually changed
      if (!this.lastDateRange || 
          this.lastDateRange.start.getTime() !== start.getTime() ||
          this.lastDateRange.end.getTime() !== end.getTime()) {
        this.lastDateRange = { start, end };
        this.loadTransactions(start, end);
      }
    });
    
    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.searchTerm.set(searchTerm);
    });
  }

  ngOnInit(): void {
    // Load all transactions to populate available months
    this.transactionService.loadAllTransactionsForMonths();
    
    // Load transactions for current date range
    const { start, end } = this.dateRange();
    this.lastDateRange = { start, end };
    this.loadTransactions(start, end);
    
    // Check for category filter from query params (drill-down from dashboard)
    // Store category name to apply filter after categories load
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.pendingCategoryFilter = params['category'];
        this.applyCategoryFilterIfReady();
      } else {
        this.pendingCategoryFilter = null;
      }
    });
    
    // Load categories (will trigger filter application after load)
    this.loadCategories();
    
    // Mark as initialized after a short delay to allow effect to work for future changes
    setTimeout(() => {
      this.isInitialized = true;
    }, 100);
    
    // Watch for route changes to update transaction type
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      const url = this.router.url;
      if (url.includes('/incomes')) {
        this.transactionTypeSignal.set('Income');
      } else {
        this.transactionTypeSignal.set('Expense');
      }
    });
    
    // Set initial transaction type
    const url = this.router.url;
    if (url.includes('/incomes')) {
      this.transactionTypeSignal.set('Income');
    } else {
      this.transactionTypeSignal.set('Expense');
    }
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        // Apply pending category filter after categories are loaded
        this.applyCategoryFilterIfReady();
      }
    });
  }
  
  private applyCategoryFilterIfReady(): void {
    if (this.pendingCategoryFilter && this.categories().length > 0) {
      const category = this.categories().find(c => c.name === this.pendingCategoryFilter);
      if (category) {
        this.selectedCategoryFilter.set(category.id);
        this.pendingCategoryFilter = null; // Clear pending filter after applying
      }
    }
  }
  
  // Get income categories only
  getIncomeCategories(): Category[] {
    return this.categories().filter(c => {
      const categoryType = c.type?.toLowerCase();
      return categoryType === 'income' || categoryType === 'all';
    });
  }
  
  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }
  
  onCategoryFilterChange(categoryId: number | null): void {
    this.selectedCategoryFilter.set(categoryId);
    
    // Update query params when category filter changes
    const queryParams: any = {};
    if (categoryId !== null) {
      const category = this.categories().find(c => c.id === categoryId);
      if (category) {
        queryParams['category'] = category.name;
      }
    } else {
      // Remove category from query params if filter is cleared
      queryParams['category'] = null;
    }
    
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge'
    });
  }
  
  toggleIncomeForm(): void {
    this.showIncomeForm.update(value => !value);
  }
  
  toggleExpenseForm(): void {
    this.showExpenseForm.update(value => !value);
    if (!this.showExpenseForm()) {
      this.editingTransactionId.set(null);
    }
  }
  
  startEditTransaction(transaction: Transaction): void {
    // Close forms if open
    if (this.showExpenseForm()) {
      this.showExpenseForm.set(false);
    }
    if (this.showIncomeForm()) {
      this.showIncomeForm.set(false);
    }
    
    // Open edit dialog
    const dialogRef = this.dialog.open(TransactionEditDialogComponent, {
      width: '600px',
      maxWidth: '90vw',
      direction: 'rtl',
      autoFocus: false,
      panelClass: 'transaction-edit-dialog-panel',
      data: {
        transaction: transaction,
        categories: this.categories()
      } as TransactionEditDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Ensure ID is preserved
        const transactionId = transaction.id;
        if (!transactionId) {
          this.snackBar.open('שגיאה: לא נמצא מזהה עסקה', 'סגור', { duration: 3000 });
          return;
        }

        // Update transaction
        this.updateTransactionFromDialog(transactionId, result);
      }
    });
  }
  
  private updateTransactionFromDialog(transactionId: number, transactionData: Partial<Transaction>): void {
    // Prevent double submission
    if (this.expenseFormLoading() || this.incomeFormLoading()) {
      return;
    }

    const isIncome = transactionData.type === 'Income';
    if (isIncome) {
      this.incomeFormLoading.set(true);
    } else {
      this.expenseFormLoading.set(true);
    }

    // Ensure ID is included in the payload
    const payload = {
      ...transactionData,
      id: transactionId // Explicitly preserve ID
    };

    this.transactionService.updateTransaction(transactionId, payload).subscribe({
      next: (updatedTransaction) => {
        const successMessage = isIncome ? 'הכנסה עודכנה בהצלחה' : 'הוצאה עודכנה בהצלחה';
        this.snackBar.open(successMessage, 'סגור', { duration: 3000 });
        
        // Reload transactions from server to ensure UI reflects all changes
        const { start, end } = this.dateRange();
        this.loadTransactions(start, end);
        
        if (isIncome) {
          this.incomeFormLoading.set(false);
        } else {
          this.expenseFormLoading.set(false);
        }
      },
      error: (error) => {
        const errorMessage = error?.error?.message || 'שגיאה בעדכון הרשומה';
        if (errorMessage.includes('Duplicate') || errorMessage.includes('כפילות')) {
          this.snackBar.open('רשומה כפולה - הרשומה כבר קיימת במערכת', 'סגור', { duration: 5000 });
        } else {
          this.snackBar.open(errorMessage, 'סגור', { duration: 3000 });
        }
        
        if (isIncome) {
          this.incomeFormLoading.set(false);
        } else {
          this.expenseFormLoading.set(false);
        }
      }
    });
  }
  
  cancelEdit(): void {
    this.editingTransactionId.set(null);
  }
  
  isEditingTransaction(transactionId: number): boolean {
    return this.editingTransactionId() === transactionId;
  }
  
  onExpenseFormSubmit(transaction: Partial<Transaction>): void {
    // Prevent double submission
    if (this.expenseFormLoading()) {
      return;
    }
    
    this.expenseFormLoading.set(true);
    
    const transactionId = this.editingTransactionId();
    const isEdit = transactionId !== null;

    if (isEdit) {
      // For edit mode, ensure ID is preserved
      const payload = {
        ...transaction,
        id: transactionId // Explicitly preserve ID
      };
      
      this.transactionService.updateTransaction(transactionId, payload).subscribe({
        next: (updatedTransaction) => {
          this.snackBar.open('הוצאה עודכנה בהצלחה', 'סגור', { duration: 3000 });
          this.cancelEdit();
          // Reload transactions from server to ensure UI reflects all changes
          const { start, end } = this.dateRange();
          this.loadTransactions(start, end);
          this.expenseFormLoading.set(false);
        },
        error: (error) => {
          const errorMessage = error?.error?.message || 'שגיאה';
          if (errorMessage.includes('Duplicate') || errorMessage.includes('כפילות')) {
            this.snackBar.open('רשומה כפולה - הרשומה כבר קיימת במערכת', 'סגור', { duration: 5000 });
          } else {
            this.snackBar.open(errorMessage, 'סגור', { duration: 3000 });
          }
          this.expenseFormLoading.set(false);
        }
      });
    } else {
      // Create new transaction
      this.transactionService.createTransaction(transaction).subscribe({
        next: () => {
          this.snackBar.open('הוצאה נוצרה בהצלחה', 'סגור', { duration: 3000 });
          this.showExpenseForm.set(false);
          // Reload transactions
          const { start, end } = this.dateRange();
          this.loadTransactions(start, end);
          this.expenseFormLoading.set(false);
        },
        error: (error) => {
          const errorMessage = error?.error?.message || 'שגיאה';
          if (errorMessage.includes('Duplicate') || errorMessage.includes('כפילות')) {
            this.snackBar.open('רשומה כפולה - הרשומה כבר קיימת במערכת', 'סגור', { duration: 5000 });
          } else {
            this.snackBar.open(errorMessage, 'סגור', { duration: 3000 });
          }
          this.expenseFormLoading.set(false);
        }
      });
    }
  }
  
  onIncomeFormSubmit(transaction: Partial<Transaction>): void {
    // Prevent double submission
    if (this.incomeFormLoading()) {
      return;
    }
    
    this.incomeFormLoading.set(true);
    
    const transactionId = this.editingTransactionId();
    const isEdit = transactionId !== null;

    if (isEdit) {
      // For edit mode, ensure ID is preserved
      const payload = {
        ...transaction,
        id: transactionId // Explicitly preserve ID
      };
      
      this.transactionService.updateTransaction(transactionId, payload).subscribe({
        next: (updatedTransaction) => {
          this.snackBar.open('הכנסה עודכנה בהצלחה', 'סגור', { duration: 3000 });
          this.cancelEdit();
          // Reload transactions from server to ensure UI reflects all changes
          const { start, end } = this.dateRange();
          this.loadTransactions(start, end);
          this.incomeFormLoading.set(false);
        },
        error: (error) => {
          const errorMessage = error?.error?.message || 'שגיאה בעדכון הרשומה';
          if (errorMessage.includes('Duplicate') || errorMessage.includes('כפילות')) {
            this.snackBar.open('רשומה כפולה - הרשומה כבר קיימת במערכת', 'סגור', { duration: 5000 });
          } else {
            this.snackBar.open(errorMessage, 'סגור', { duration: 3000 });
          }
          this.incomeFormLoading.set(false);
        }
      });
    } else {
      // Create new transaction
      this.transactionService.createTransaction(transaction).subscribe({
        next: () => {
          this.snackBar.open('הכנסה נוצרה בהצלחה', 'סגור', { duration: 3000 });
          this.showIncomeForm.set(false);
          // Reload transactions
          const { start, end } = this.dateRange();
          this.loadTransactions(start, end);
          this.incomeFormLoading.set(false);
        },
        error: (error) => {
          const errorMessage = error?.error?.message || 'שגיאה';
          this.snackBar.open(errorMessage, 'סגור', { duration: 3000 });
          this.incomeFormLoading.set(false);
        }
      });
    }
  }
  
  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategoryFilter.set(null);
    // Clear query params when clearing filters
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      queryParamsHandling: 'merge'
    });
  }
  
  onSortChange(sort: Sort): void {
    if (sort.active) {
      this.sortColumn.set(sort.active);
      this.sortDirection.set(sort.direction === 'asc' ? 'asc' : 'desc');
    } else {
      // If no sort is active, default to date DESC
      this.sortColumn.set('date');
      this.sortDirection.set('desc');
    }
  }
  
  getCategoryIcon(categoryId: number): string | null {
    return this.formatterService.getCategoryIcon(categoryId, this.categories());
  }

  getCategoryColor(categoryId: number): string {
    return this.formatterService.getCategoryColor(categoryId, this.categories());
  }

  getCurrencySymbol(currency?: string): string {
    return this.formatterService.getCurrencySymbol(currency);
  }

  loadTransactions(start?: Date, end?: Date): void {
    const dateRange = start && end ? { start, end } : this.dateRange();
    
    this.transactionService.getTransactions(dateRange.start, dateRange.end).subscribe({
      error: () => {
        this.snackBar.open('שגיאה בטעינת העסקאות', 'סגור', { duration: 3000 });
      }
    });
  }

  deleteTransaction(id: number): void {
    this.confirmDialog.confirmDelete('האם אתה בטוח שברצונך למחוק את העסקה?').subscribe(confirmed => {
      if (confirmed) {
        this.transactionService.deleteTransaction(id).subscribe({
          next: () => {
            this.snackBar.open('עסקה נמחקה בהצלחה', 'סגור', { duration: 3000 });
            // Signal will automatically update, no need to reload
          },
          error: () => {
            this.snackBar.open('שגיאה במחיקת העסקה', 'סגור', { duration: 3000 });
          }
        });
      }
    });
  }

  onHalvesToggle(tx: Transaction, checked: boolean): void {
    const prev = tx.IsHalves || false;
    tx.IsHalves = checked;

    this.transactionService.updateIsHalves(tx.id, checked).subscribe({
      next: () => {
        this.snackBar.open('עודכן בהצלחה', 'סגור', { duration: 3000 });
      },
      error: () => {
        tx.IsHalves = prev; // החזרה למצב קודם
        this.snackBar.open('עדכון נכשל', 'סגור', { duration: 3000 });
      }
    });
  }

  uploadCreditCardFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.style.display = 'none'; // הסתר את הקלט
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (fileExtension === 'csv') {
          this.processCsvFile(file);
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
          this.processExcelFile(file);
        } else {
          this.snackBar.open('סוג קובץ לא נתמך. אנא העלה קובץ CSV, XLSX או XLS', 'סגור', { duration: 5000 });
        }
      }
      // הסר את הקלט מהדף אחרי השימוש
      document.body.removeChild(input);
    };
    // הוסף את הקלט לדף (מוסתר) ואז לחץ עליו
    document.body.appendChild(input);
    input.click();
  }

  private processCsvFile(file: File): void {
    // Upload file without month/year - server will extract from file
    this.transactionService.uploadTransactionsFile(file).subscribe({
        next: (response) => {
          // Show success dialog
          this.dialog.open(UploadResultsDialogComponent, {
            width: '500px',
            maxWidth: '90vw',
            direction: 'rtl',
            autoFocus: false,
            data: {
              success: true,
              message: 'הקובץ הועלה בהצלחה',
              totalCreated: response.totalCreated,
              totalParsed: response.totalParsed
            } as UploadResultsData
          });
          
          // Reload transactions from server to ensure UI matches server data
          // Use current date range from settings
          const { start, end } = this.dateRange();
          
          // Set flag to prevent effect from running during refresh
          this.isRefreshing = true;
          this.lastDateRange = { start, end };
          
          this.transactionService.refreshTransactions(start, end).subscribe({
            next: () => {
              // Reset flag after refresh completes
              this.isRefreshing = false;
            },
            error: () => {
              this.isRefreshing = false;
              this.snackBar.open('שגיאה ברענון העסקאות', 'סגור', { duration: 3000 });
            }
          });
        },
        error: (error) => {
          const errorMessage = error?.error?.message || 'הטעינה נכשלה – אנא בדוק את הקובץ ונסה שוב';
          
          // Show error dialog
          this.dialog.open(UploadResultsDialogComponent, {
            width: '500px',
            maxWidth: '90vw',
            direction: 'rtl',
            autoFocus: false,
            data: {
              success: false,
              message: errorMessage
            } as UploadResultsData
          });
          
          this.logger.error('Error uploading CSV file', error);
        }
      });
  }

  private processExcelFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        // Extract card number (last 4 digits) from file name using shared helper
        const cardNumberFromFileName = this.cardNumberHelper.extractCardNumberFromFileName(file.name);
        
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read all rows without header to manually process
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const allRows: any[] = [];
        
        for (let row = 0; row <= range.e.r; row++) {
          const rowData: any = {};
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            const cell = worksheet[cellAddress];
            if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
              let cellValue: string;
              
              // Priority 1: Use formatted value (w) if available - this is what Excel displays
              // This is the most reliable way to get dates as they appear in Excel
              if (cell.w) {
                cellValue = cell.w.trim();
              } 
              // Priority 2: Check if it's a date serial number and convert it
              else if (cell.t === 'n' && typeof cell.v === 'number') {
                const cellNum = cell.v;
                // Excel date serial numbers are typically between 1 (Jan 1, 1900) and ~100000
                // Check if format code suggests it's a date, or if number is in typical date range
                const formatCode = cell.z ? cell.z.toLowerCase() : '';
                const looksLikeDate = formatCode.includes('d') || formatCode.includes('m') || formatCode.includes('y') ||
                                     (cellNum >= 1 && cellNum < 50000); // Reasonable date range
                
                if (looksLikeDate) {
                  try {
                    // Convert Excel serial date to JavaScript date
                    // Excel epoch is Jan 1, 1900, but Excel incorrectly treats 1900 as leap year
                    // So we use Dec 30, 1899 as base and add the serial number
                    // Serial 1 = Jan 1, 1900, Serial 2 = Jan 2, 1900, etc.
                    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
                    const jsDate = new Date(excelEpoch.getTime() + (cellNum - 1) * 86400000);
                    
                    // Validate the date is reasonable
                    if (!isNaN(jsDate.getTime()) && jsDate.getFullYear() >= 1900 && jsDate.getFullYear() <= 2100) {
                      // Format as DD/MM/YY (matching Hebrew date format)
                      const day = String(jsDate.getDate()).padStart(2, '0');
                      const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                      const year = jsDate.getFullYear() % 100;
                      cellValue = `${day}/${month}/${year.toString().padStart(2, '0')}`;
                    } else {
                      cellValue = String(cell.v).trim();
                    }
                  } catch {
                    cellValue = String(cell.v).trim();
                  }
                } else {
                  cellValue = String(cell.v).trim();
                }
              } 
              // Priority 3: Convert other types to string
              else {
                cellValue = String(cell.v).trim();
              }
              
              rowData[col] = cellValue;
            }
          }
          if (Object.keys(rowData).length > 0) {
            allRows.push(rowData);
          }
        }

        if (allRows.length === 0) {
          this.snackBar.open('הקובץ ריק', 'סגור', { duration: 3000 });
          return;
        }

        // Extract month and year from the file
        let monthYear = this.monthYearExtractor.extractMonthYearFromRawExcel(allRows);
        this.logger.debug('monthYear (original)', monthYear);
        if (!monthYear) {
          this.snackBar.open('לא ניתן לזהות חודש ושנה בקובץ. אנא ודא שהקובץ מכיל תאריך ב-A3 או C2', 'סגור', { duration: 5000 });
          return;
        }
        
        // Subtract one month from the extracted month/year
        // If month is January (1), go back to December of previous year
        if (monthYear.month === 1) {
          monthYear = {
            year: monthYear.year - 1,
            month: 12
          };
        } else {
          monthYear = {
            year: monthYear.year,
            month: monthYear.month - 1
          };
        }
        
        this.logger.debug('monthYear (adjusted - subtracted 1 month)', monthYear);

        // Find header row by looking for column names
        let headerRowIndex = -1;
        let columnMapping: { [key: number]: string } = {};
        
        for (let i = 0; i < Math.min(allRows.length, 15); i++) {
          const row = allRows[i];
          // Normalize row values - replace newlines and normalize spaces
          const rowValues = Object.values(row).map(v => {
            const normalized = String(v).toLowerCase()
              .replace(/\r\n/g, ' ')
              .replace(/\r/g, ' ')
              .replace(/\n/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            return normalized;
          });
          
          // Check if this row contains header keywords (CAL or Isracard format)
          // Look for patterns that indicate this is a header row
          const normalizedRowText = rowValues.join(' ');
          
          const hasDateHeader = rowValues.some(v => 
            v.includes('תאריך עסקה') || 
            v.includes('תאריך רכישה') ||
            v.includes('תאריך רכיש') ||
            (v.includes('תאריך') && v.includes('עסקה')) ||
            (v.includes('תאריך') && v.includes('רכישה'))
          );
          
          const hasMerchantHeader = rowValues.some(v => 
            v.includes('שם בית עסק') ||
            v.includes('שם בית ע') ||
            (v.includes('שם') && v.includes('בית') && v.includes('עסק'))
          );
          
          const hasAmountHeader = rowValues.some(v => 
            v.includes('סכום חיוב') || 
            v.includes('סכום עסקה') ||
            v.includes('סכום חיו') ||
            v.includes('סכום עס') ||
            (v.includes('סכום') && v.includes('חיוב')) ||
            (v.includes('סכום') && v.includes('עסקה'))
          );
          
          // Also check if row has multiple column-like values (indicates header row)
          const hasMultipleColumns = Object.keys(row).length >= 4;
          
          if (hasDateHeader && hasMerchantHeader && hasAmountHeader && hasMultipleColumns) {
            headerRowIndex = i;
            // Create column mapping for both CAL and Isracard formats
            Object.keys(row).forEach(colIndex => {
              const rawValue = String(row[colIndex] || '');
              // Normalize the header value
              const headerValue = rawValue.toLowerCase()
                .replace(/\r\n/g, ' ')
                .replace(/\r/g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              
              // Date fields - check for both combined and separate words
              if (headerValue.includes('תאריך עסקה') || 
                  headerValue.includes('תאריך רכישה') || 
                  headerValue.includes('תאריך רכיש') ||
                  (headerValue.includes('תאריך') && headerValue.includes('עסקה')) ||
                  (headerValue.includes('תאריך') && headerValue.includes('רכישה'))) {
                columnMapping[parseInt(colIndex)] = 'transactionDate';
              } else if (headerValue.includes('תאריך חיוב') || 
                         headerValue.includes('תאריך חיו') ||
                         (headerValue.includes('תאריך') && headerValue.includes('חיוב'))) {
                columnMapping[parseInt(colIndex)] = 'billingDate';
              }
              // Merchant name
              else if (headerValue.includes('שם בית עסק') || 
                       headerValue.includes('שם בית ע') ||
                       (headerValue.includes('שם') && headerValue.includes('בית') && headerValue.includes('עסק'))) {
                columnMapping[parseInt(colIndex)] = 'merchantName';
              }
              // Amount fields - prefer charge amount
              else if (headerValue.includes('סכום חיוב') || 
                       headerValue.includes('סכום חיו') ||
                       (headerValue.includes('סכום') && headerValue.includes('חיוב'))) {
                columnMapping[parseInt(colIndex)] = 'chargeAmount';
              } else if (headerValue.includes('סכום עסקה') || 
                         headerValue.includes('סכום עס') ||
                         (headerValue.includes('סכום') && headerValue.includes('עסקה'))) {
                columnMapping[parseInt(colIndex)] = 'transactionAmount';
              }
              // Currency
              else if (headerValue.includes('מטבע עסק') || 
                       headerValue.includes('מטבע חי') || 
                       headerValue.includes('מטבע חיו') ||
                       (headerValue.includes('מטבע') && (headerValue.includes('עסק') || headerValue.includes('חיוב')))) {
                columnMapping[parseInt(colIndex)] = 'currency';
              }
              // Card number (last 4 digits)
              else if (headerValue.includes('מספר כרטיס') || 
                       headerValue.includes('4 ספרות אחרונות') ||
                       headerValue.includes('4 ספרות') ||
                       (headerValue.includes('מספר') && headerValue.includes('כרטיס')) ||
                       (headerValue.includes('ספרות') && headerValue.includes('אחרונות'))) {
                columnMapping[parseInt(colIndex)] = 'cardNumber';
              }
              // Reference/Voucher number
              else if (headerValue.includes('מס\' שובר') || 
                       headerValue.includes('מספר שובר') || 
                       headerValue.includes('אסמכתא') || 
                       headerValue.includes('מס שובר') ||
                       (headerValue.includes('שובר') && (headerValue.includes('מס') || headerValue.includes('מספר')))) {
                columnMapping[parseInt(colIndex)] = 'referenceNumber';
              }
              // Transaction type
              else if (headerValue.includes('סוג עסקה') || 
                       (headerValue.includes('סוג') && headerValue.includes('עסקה')) ||
                       headerValue === 'סוג') {
                columnMapping[parseInt(colIndex)] = 'transactionType';
              }
              // Branch/Category
              else if (headerValue.includes('ענף') || headerValue === 'ענף') {
                columnMapping[parseInt(colIndex)] = 'branch';
              }
              // Category (MAX files)
              else if (headerValue.includes('קטגוריה') || headerValue === 'קטגוריה') {
                columnMapping[parseInt(colIndex)] = 'branch'; // Use branch field for category in MAX
              }
              // Discount Club Key (MAX files) - can be used as ReferenceNumber
              else if (headerValue.includes('מפתח דיסקו') || 
                       headerValue.includes('מפתח דיסק') ||
                       (headerValue.includes('מפתח') && headerValue.includes('דיסקו'))) {
                columnMapping[parseInt(colIndex)] = 'referenceNumber'; // Use as reference number
              }
              // Notes/Additional details
              else if (headerValue.includes('הערות') || 
                       headerValue.includes('פירוט נוסף') || 
                       headerValue.includes('פירוט נוס') ||
                       headerValue === 'הערות') {
                columnMapping[parseInt(colIndex)] = 'notes';
              }
              // Installments
              else if (headerValue.includes('תשלומים') || headerValue === 'תשלומים') {
                columnMapping[parseInt(colIndex)] = 'installments';
              }
            });
            break;
          }
        }

        if (headerRowIndex === -1 || Object.keys(columnMapping).length === 0) {
          this.snackBar.open('לא נמצאה שורת כותרות בקובץ. אנא ודא שהקובץ מכיל עמודות: תאריך עסקה, שם בית עסק, סכום חיוב', 'סגור', { duration: 5000 });
          return;
        }

        // Extract data rows (skip header row)
        const dataRows = allRows.slice(headerRowIndex + 1);
        
        // Map rows to named objects
        const jsonData = dataRows.map(row => {
          const mappedRow: any = {};
          Object.keys(columnMapping).forEach(colIndex => {
            const fieldName = columnMapping[parseInt(colIndex)];
            if (row[colIndex] !== undefined) {
              mappedRow[fieldName] = row[colIndex];
            }
          });
          // Add card number extracted from file name
          mappedRow._cardNumber = cardNumberFromFileName;
          return mappedRow;
        }).filter(row => Object.keys(row).length > 0);

        if (jsonData.length === 0) {
          this.snackBar.open('הקובץ ריק', 'סגור', { duration: 3000 });
          return;
        }

        // Convert Excel data to TransactionDto format
        const transactions = this.convertExcelToTransactions(jsonData);
        
        if (transactions.length === 0) {
          this.snackBar.open('לא נמצאו עסקאות תקינות בקובץ. אנא ודא שהקובץ מכיל עמודות: תאריך עסקה, שם בית עסק, סכום חיוב', 'סגור', { duration: 5000 });
          return;
        }

        // Store month and year values to avoid null check issues in callback
        const month = monthYear.month;
        const year = monthYear.year;

        // Send to backend with extracted month and year
        this.transactionService.uploadTransactionsJson(transactions, year, month).subscribe({
            next: (response) => {
              // Show success dialog
              this.dialog.open(UploadResultsDialogComponent, {
                width: '500px',
                maxWidth: '90vw',
                direction: 'rtl',
                autoFocus: false,
                data: {
                  success: true,
                  message: 'הקובץ הועלה בהצלחה',
                  totalCreated: response.totalCreated,
                  totalParsed: response.totalParsed
                } as UploadResultsData
              });
              
              // Reload transactions from server to ensure UI matches server data
              // Calculate date range for the month (first day of month to last day)
              const monthStart = new Date(Date.UTC(year, month - 1, 1));
              const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
              
              // Set flag to prevent effect from running during refresh
              this.isRefreshing = true;
              this.lastDateRange = { start: monthStart, end: monthEnd };
              
              this.transactionService.refreshTransactions(monthStart, monthEnd).subscribe({
                next: () => {
                  // Reset flag after refresh completes
                  this.isRefreshing = false;
                },
                error: () => {
                  this.isRefreshing = false;
                  this.snackBar.open('שגיאה ברענון העסקאות', 'סגור', { duration: 3000 });
                }
              });
            },
            error: (error) => {
              const errorMessage = error?.error?.message || 'הטעינה נכשלה – אנא בדוק את הקובץ ונסה שוב';
              
              // Show error dialog
              this.dialog.open(UploadResultsDialogComponent, {
                width: '500px',
                maxWidth: '90vw',
                direction: 'rtl',
                autoFocus: false,
                data: {
                  success: false,
                  message: errorMessage
                } as UploadResultsData
              });
              
              this.logger.error('Error uploading Excel file', error);
            }
          });
      } catch (error) {
        this.snackBar.open('שגיאה בקריאת הקובץ', 'סגור', { duration: 3000 });
        this.logger.error('Error reading Excel file', error);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  private convertExcelToTransactions(data: any[]): Partial<Transaction>[] {
    const transactions: Partial<Transaction>[] = [];

    // Helper function to get field value (works with mapped fields)
    const getField = (row: any, fieldName: string, fallbackNames: string[] = []): any => {
      // First try the mapped field name
      if (row[fieldName] !== undefined && row[fieldName] !== null && row[fieldName] !== '') {
        return row[fieldName];
      }
      
      // Then try fallback names
      for (const name of fallbackNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
          return row[name];
        }
      }
      
      return null;
    };

    data.forEach((row: any) => {
      try {
        // Skip empty rows
        if (!row || Object.keys(row).length === 0) {
          return;
        }

        // Get transaction date (mapped field: transactionDate)
        const transactionDateStr = getField(row, 'transactionDate', [
          'תאריך עסקה', 'תאריך רכישה', 'תאריך', 'TransactionDate', 'Date', 'date'
        ]);
        
        // Skip if no date found - this is not a valid transaction row
        if (!transactionDateStr) {
          return;
        }
        
        // Get billing date (mapped field: billingDate)
        const billingDateStr = getField(row, 'billingDate', [
          'תאריך חיוב', 'BillingDate', 'billingDate'
        ]) || transactionDateStr;
        
        // Parse the original dates - keep them as they are in the file
        const transactionDate = this.excelDateParser.parseDate(transactionDateStr);
        const billingDate = this.excelDateParser.parseDate(billingDateStr);
        
        // Validate dates - parseDate returns ISO string, verify it's valid
        if (!transactionDate || !billingDate) {
          this.logger.warn('Invalid dates:', { transactionDateStr, billingDateStr });
          return;
        }
        
        // Verify the ISO strings are valid dates
        const transactionDateObj = new Date(transactionDate);
        const billingDateObj = new Date(billingDate);
        if (isNaN(transactionDateObj.getTime()) || isNaN(billingDateObj.getTime())) {
          this.logger.warn('Invalid date format:', { transactionDate, billingDate });
          return;
        }
        
        // Get amount - prefer chargeAmount, fallback to transactionAmount
        const amountStr = getField(row, 'chargeAmount', [
          'transactionAmount',
          'סכום חיוב', 'סכום עסקה', 'סכום', 'Amount', 'amount'
        ]);
        
        // Skip if no amount found
        if (!amountStr) {
          return;
        }
        
        const amount = Math.abs(parseFloat(String(amountStr).replace(/[₪$€,\s]/g, '')) || 0);
        
        // Skip zero or invalid amounts
        if (amount <= 0 || isNaN(amount)) {
          return;
        }

        // Get merchant name (mapped field: merchantName)
        const merchantName = getField(row, 'merchantName', [
          'שם בית עסק', 'בית עסק', 'MerchantName', 'merchantName'
        ]);
        
        // Skip if no merchant name (likely invalid row)
        if (!merchantName || String(merchantName).trim() === '') {
          return;
        }

        // Determine type
        const typeStr = getField(row, 'transactionType', ['סוג עסקה', 'סוג', 'Type', 'type']) || '';
        let type: 'Income' | 'Expense' = 'Expense';
        if (typeStr === 'הכנסה' || String(typeStr).toLowerCase() === 'income') {
          type = 'Income';
        } else if (parseFloat(String(amountStr)) < 0) {
          type = 'Income';
        }

        // Parse installments from notes - CAL format "תשלום X מתוך Y"
        let installments: number | undefined = undefined;
        const notes = getField(row, 'notes', ['הערות', 'Notes', 'notes']) || '';
        if (notes) {
          const installmentMatch = String(notes).match(/תשלום\s+(\d+)\s+מתוך\s+(\d+)/);
          if (installmentMatch) {
            installments = parseInt(installmentMatch[2]); // Total number of installments
          }
        }
        // Also check direct installments field
        if (!installments) {
          const installmentsValue = getField(row, 'installments', ['תשלומים', 'Installments', 'installments']);
          if (installmentsValue) {
            installments = parseInt(String(installmentsValue));
          }
        }

        // Parse currency (mapped field: currency)
        let currency = getField(row, 'currency', ['מטבע', 'Currency', 'currency']) || 'ILS';
        const amountStrWithCurrency = String(amountStr);
        if (amountStrWithCurrency.includes('€') || amountStrWithCurrency.includes('EUR')) {
          currency = 'EUR';
        } else if (amountStrWithCurrency.includes('$') || amountStrWithCurrency.includes('USD')) {
          currency = 'USD';
        } else if (currency && !['ILS', 'EUR', 'USD'].includes(currency.toUpperCase())) {
          // If currency field contains symbol, extract it
          if (currency.includes('₪')) currency = 'ILS';
          else if (currency.includes('€')) currency = 'EUR';
          else if (currency.includes('$')) currency = 'USD';
          else currency = 'ILS';
        }

        // Get reference number (mapped field: referenceNumber)
        const referenceNumber = getField(row, 'referenceNumber', [
          'אסמכתא', 'מס\' שובר', 'מספר שובר', 'ReferenceNumber', 'referenceNumber'
        ]);

        // Get branch (mapped field: branch)
        const branch = getField(row, 'branch', ['ענף', 'Branch', 'branch']);

        // Get card number - prefer from row data, fallback to file name extraction
        let cardNumber: string | undefined = undefined;
        const cardNumberFromRow = getField(row, 'cardNumber', [
          'מספר כרטיס', '4 ספרות אחרונות', 'CardNumber', 'cardNumber'
        ]);
        if (cardNumberFromRow) {
          // Extract last 4 digits from card number field using shared helper
          cardNumber = this.cardNumberHelper.extractLast4Digits(String(cardNumberFromRow));
        } else if (row._cardNumber) {
          // Use card number extracted from file name
          cardNumber = row._cardNumber;
        }

        // Source is always "Excel Import"
        const source = 'Excel Import';

        // parseDate already returns ISO string, use it directly
        // Final validation before creating transaction
        if (!transactionDate || !billingDate || !merchantName || amount <= 0) {
          return;
        }

        // Parse IsHalves from Excel (if column exists), default to false
        const isHalvesValue = getField(row, 'isHalves', ['מחציות', 'IsHalves', 'isHalves']);
        const isHalves = isHalvesValue !== null && isHalvesValue !== undefined && String(isHalvesValue).toLowerCase() === 'true';

        const transaction: Partial<Transaction> = {
          transactionDate: transactionDate, // ISO string
          billingDate: billingDate, // ISO string
          amount: amount,
          type: type,
          merchantName: String(merchantName).trim(),
          source: source,
          referenceNumber: referenceNumber ? String(referenceNumber).trim() : undefined,
          cardNumber: cardNumber, // Extracted from file name or row data
          currency: currency,
          installments: installments,
          branch: branch ? String(branch).trim() : undefined,
          notes: notes ? String(notes).trim() : undefined,
          categoryId: 1, // Will be set by backend based on Branch
          IsHalves: isHalves // Default to false if not provided
        };

        transactions.push(transaction);
      } catch (error) {
        this.logger.warn('Failed to parse Excel row:', row, error);
      }
    });

    return transactions;
  }

}

