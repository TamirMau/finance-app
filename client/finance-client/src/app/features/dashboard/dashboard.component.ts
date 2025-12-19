import { Component, OnInit, OnDestroy, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, Event } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TransactionService } from '../../core/services/transaction.service';
import { UserSettingsService } from '../../core/services/user-settings.service';
import { CategoryService } from '../../core/services/category.service';
import { BankStatementService } from '../../core/services/bank-statement.service';
import { Category } from '../../core/models/category.model';
import { BankStatement, BankStatementRow } from '../../core/models/bank-statement.model';
import { Transaction } from '../../core/models/transaction.model';
import { MonthSelectorComponent } from '../../shared/components/month-selector/month-selector.component';
import { TransactionHelperService } from '../../core/utils/transaction-helper.service';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { LoggerService } from '../../core/services/logger.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MonthSelectorComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})

export class DashboardComponent implements OnInit, OnDestroy {
  // Use signals from service
  allTransactions = computed(() => this.transactionService.transactions());
  loading = computed(() => this.transactionService.loading());
  
  // Get date range from settings
  dateRange = computed(() => {
    const selectedMonth = this.settingsService.selectedMonth();
    return this.settingsService.getDateRange(selectedMonth || undefined);
  });
  
  // Filter transactions based on settings
  transactions = computed(() => {
    const all = this.allTransactions();
    const { start, end } = this.dateRange();
    return this.settingsService.filterTransactionsByDateRange(all, start, end);
  });
  
  // Total bank credits for selected month (הכנסות מהבנק לחודש נבחר)
  totalBankCreditsForMonth = computed(() => {
    const filtered = this.filteredBankTransactionsForMonth();
    
    // Filter only rows with credits (Credit > 0 and not null)
    const creditRows = filtered.filter((row: BankStatementRow) => 
      row.credit !== null && row.credit !== undefined && row.credit > 0
    );
    
    // Sum all credits for the selected month
    const total = creditRows.reduce((sum: number, row: BankStatementRow) => sum + (row.credit || 0), 0);
    
    return total;
  });

  // Total bank debits for selected month (הוצאות מהבנק לחודש נבחר)
  totalBankDebitsForMonth = computed(() => {
    const filtered = this.filteredBankTransactionsForMonth();
    
    // Filter only rows with debits (Debit > 0 and not null)
    const debitRows = filtered.filter((row: BankStatementRow) => 
      row.debit !== null && row.debit !== undefined && row.debit > 0
    );
    
    // Sum all debits for the selected month
    const total = debitRows.reduce((sum: number, row: BankStatementRow) => sum + (row.debit || 0), 0);
    
    return total;
  });

  // Computed signals for statistics
  // Total Income = Transactions (Income) only, filtered by AssignedMonthDate for selected month
  totalIncome = computed(() => {
    const transactions = this.transactions();
    return this.transactionHelper.calculateTotalByType(transactions, 'Income');
  });

  // Total Expenses = Transactions (Expense) only, filtered by AssignedMonthDate for selected month
  totalExpenses = computed(() => {
    const transactions = this.transactions();
    return this.transactionHelper.calculateTotalByType(transactions, 'Expense');
  });
  
  // Current status: Income - Expenses + Bank Balance
  currentStatus = computed(() => {
    const income = this.totalIncome();
    const expenses = this.totalExpenses();
    const bankBalance = this.bankBalance() ?? 0;
    return income - expenses + bankBalance;
  });
  
  transactionCount = computed(() => this.transactions().length);

  // Categories for charts
  categories = signal<Category[]>([]);
  categoriesLoading = signal<boolean>(false);

  // Bank statement data
  bankStatement = signal<BankStatement | null>(null);
  bankTransactionsLoading = signal<boolean>(false);

  // Bank balance from statement (same as shown in bank-statements page)
  bankBalance = computed(() => {
    const statement = this.bankStatement();
    return statement?.balance ?? null;
  });

  // Get month range (always from 1st to last day of month, regardless of dateRangeType)
  monthRange = computed(() => {
    const selectedMonth = this.settingsService.selectedMonth();
    let targetMonth: Date;
    
    if (selectedMonth) {
      targetMonth = new Date(Date.UTC(selectedMonth.getUTCFullYear(), selectedMonth.getUTCMonth(), 1));
    } else {
      // Use current month
      const now = new Date();
      targetMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    }
    
    const targetYear = targetMonth.getUTCFullYear();
    const targetMonthIndex = targetMonth.getUTCMonth();
    
    // Always from 1st of month to last day of month
    const start = new Date(Date.UTC(targetYear, targetMonthIndex, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0, 23, 59, 59, 999));
    
    return { start, end };
  });

  // Filtered bank transactions for selected month (from 1st to last day)
  filteredBankTransactionsForMonth = computed(() => {
    const statement = this.bankStatement();
    if (!statement || !statement.rows || statement.rows.length === 0) {
      return [];
    }

    const { start, end } = this.monthRange();
    
    // Filter transactions by date range (from 1st of month to last day of month)
    const filtered = statement.rows.filter((row: BankStatementRow) => {
      if (!row.date) {
        return false;
      }
      
      // Date should already be parsed as UTC in the service
      const rowDate = row.date instanceof Date ? row.date : new Date(row.date);
      if (isNaN(rowDate.getTime())) {
        return false;
      }
      
      // Use UTC for date comparison to avoid timezone issues
      // The date should already be in UTC from the service normalization
      const rowYear = rowDate.getUTCFullYear();
      const rowMonth = rowDate.getUTCMonth();
      const rowDay = rowDate.getUTCDate();
      
      const startYear = start.getUTCFullYear();
      const startMonth = start.getUTCMonth();
      const startDay = start.getUTCDate();
      
      const endYear = end.getUTCFullYear();
      const endMonth = end.getUTCMonth();
      const endDay = end.getUTCDate();
      
      // Create date objects at start of day for comparison
      const rowDateObj = new Date(Date.UTC(rowYear, rowMonth, rowDay, 0, 0, 0, 0));
      const startDateObj = new Date(Date.UTC(startYear, startMonth, startDay, 0, 0, 0, 0));
      const endDateObj = new Date(Date.UTC(endYear, endMonth, endDay, 23, 59, 59, 999));
      
      const isInRange = rowDateObj.getTime() >= startDateObj.getTime() && rowDateObj.getTime() <= endDateObj.getTime();
      
      // Check if transaction date is within range (inclusive)
      return isInRange;
    });
    
    return filtered;
  });

  // Total credits from bank transactions for selected month
  bankCreditsForMonth = computed(() => {
    const filtered = this.filteredBankTransactionsForMonth();
    
    // Filter only rows with credits
    const creditRows = filtered.filter((row: BankStatementRow) => row.credit && row.credit > 0);

    
    const total = creditRows.reduce((sum: number, row: BankStatementRow) => sum + (row.credit || 0), 0);
    
    return total;
  });

  // All bank statement rows with credits (for monthly income calculation)
  allBankCredits = computed(() => {
    const statement = this.bankStatement();
    if (!statement || !statement.rows || statement.rows.length === 0) {
      this.logger.debug('No bank statement data available');
      return [];
    }
    
    // Filter only rows with credits (Credit > 0 and not null)
    const credits = statement.rows.filter((row: BankStatementRow) => 
      row.credit !== null && row.credit !== undefined && row.credit > 0
    );
    
    this.logger.debug('Bank credits found', {
      totalRows: statement.rows.length,
      creditRows: credits.length,
      totalCredits: credits.reduce((sum, row) => sum + (row.credit || 0), 0)
    });
    
    return credits;
  });

  // All bank statement rows with debits (for monthly expense calculation)
  allBankDebits = computed(() => {
    const statement = this.bankStatement();
    if (!statement || !statement.rows || statement.rows.length === 0) {
      this.logger.debug('No bank statement data available for debits');
      return [];
    }
    
    // Filter only rows with debits (Debit > 0 and not null)
    const debits = statement.rows.filter((row: BankStatementRow) => 
      row.debit !== null && row.debit !== undefined && row.debit > 0
    );
    
    this.logger.debug('Bank debits found', {
      totalRows: statement.rows.length,
      debitRows: debits.length,
      totalDebits: debits.reduce((sum, row) => sum + (row.debit || 0), 0)
    });
    
    return debits;
  });

  // Total expenses from transactions for pie chart (to match pieChartData calculation)
  totalExpensesForPieChart = computed(() => {
    const transactions = this.transactions();
    const expenses = this.transactionHelper.filterByType(transactions, 'Expense');
    return expenses.reduce((sum, expense) => {
      return sum + this.transactionHelper.parseAmount(expense.amount);
    }, 0);
  });

  // Chart data (simplified structure for future chart implementation)
  pieChartData = computed(() => {
    const transactions = this.transactions();
    const categories = this.categories();
    const expenses = this.transactionHelper.filterByType(transactions, 'Expense');
    const categoryMap = new Map<number, number>();
    
    expenses.forEach(expense => {
      const amount = this.transactionHelper.parseAmount(expense.amount);
      const current = categoryMap.get(expense.categoryId) || 0;
      categoryMap.set(expense.categoryId, current + amount);
    });

    // Soft color palette matching server-side palette
    const colorPalette = [
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
      '#60A5FA', // Soft Sky Blue
      '#94A3B8', // Soft Slate
      '#E9D5FF', // Soft Fuchsia
      '#34D399', // Soft Aqua Green
      '#FDE68A', // Soft Yellow
      '#A78BFA'  // Soft Lavender
    ];

    const usedColors = new Set<string>();
    let colorIndex = 0;

    const getUniqueColor = (originalColor: string | undefined, categoryName: string): string => {
      const defaultColor = '#9CA3AF';
      const color = originalColor && originalColor !== '#2196F3' && originalColor !== '#000000' 
        ? originalColor 
        : defaultColor;
      
      // If color is already used, find next available from palette
      if (usedColors.has(color)) {
        while (colorIndex < colorPalette.length && usedColors.has(colorPalette[colorIndex])) {
          colorIndex++;
        }
        if (colorIndex < colorPalette.length) {
          const newColor = colorPalette[colorIndex];
          usedColors.add(newColor);
          colorIndex++;
          return newColor;
        }
        // If palette exhausted, generate a color based on category name hash
        return this.generateColorFromName(categoryName, usedColors);
      }
      
      usedColors.add(color);
      return color;
    };

    const result = Array.from(categoryMap.entries()).map(([categoryId, amount]) => {
      const category = categories.find((c: Category) => c.id === categoryId);
      const categoryName = category?.name || 'ללא קטגוריה';
      const originalColor = category?.color;
      return {
        name: categoryName,
        amount,
        color: getUniqueColor(originalColor, categoryName)
      };
    }).sort((a, b) => b.amount - a.amount);

    return result;
  });

  lineChartData = computed(() => {
    // Use all transactions for income, and bank debits for expenses
    // Group by assignedMonthDate (תאריך שיוך לחודש) for proper monthly calculations
    const transactions = this.allTransactions();
    const bankCredits = this.allBankCredits();
    const bankDebits = this.allBankDebits();
    const monthMap = new Map<string, { income: number; expense: number }>();
    
    // Process regular transactions (only for Income, not for Expense)
    transactions.forEach((t: Transaction) => {
      if (!t) return;
      
      // Use assignedMonthDate for grouping (תאריך שיוך לחודש)
      // This is the date used for monthly reports and calculations
      let dateValue: string | Date | undefined = t.assignedMonthDate;
      
      // Only fallback to transactionDate or date if assignedMonthDate is not available
      if (!dateValue) {
        dateValue = t.transactionDate || t.date;
      }
      
      if (!dateValue) return;
      
      // Parse date as UTC to avoid timezone issues
      // assignedMonthDate is stored as "2025-12-01T00:00:00" (UTC, no Z)
      let year: number;
      let month: number;
      
      if (dateValue instanceof Date) {
        year = dateValue.getUTCFullYear();
        month = dateValue.getUTCMonth() + 1; // getUTCMonth() returns 0-11
      } else if (typeof dateValue === 'string') {
        const dateStr = dateValue.trim();
        
        // If it ends with 'Z', it's already UTC
        if (dateStr.endsWith('Z')) {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            this.logger.warn('Invalid date for transaction:', t.id, dateValue);
            return;
          }
          year = date.getUTCFullYear();
          month = date.getUTCMonth() + 1;
        } else {
          // Parse manually as UTC: "2025-12-01T00:00:00" -> UTC date
          // Extract year, month, day from the string
          const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (match) {
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10); // Month is 1-indexed in the string (12 = December)
            // Validate the parsed values
            if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
              this.logger.warn('Invalid date format for transaction:', t.id, dateValue);
              return;
            }
          } else {
            // Fallback: try to parse as Date (may have timezone issues)
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              this.logger.warn('Invalid date for transaction:', t.id, dateValue);
              return;
            }
            year = date.getUTCFullYear();
            month = date.getUTCMonth() + 1;
          }
        }
      } else {
        // Try to convert to string first
        const date = new Date(String(dateValue));
        if (isNaN(date.getTime())) {
          this.logger.warn('Invalid date for transaction:', t.id, dateValue);
          return;
        }
        year = date.getUTCFullYear();
        month = date.getUTCMonth() + 1;
      }
      
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const amount = this.transactionHelper.parseAmount(t.amount);
      
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { income: 0, expense: 0 });
      }
      
      const monthData = monthMap.get(monthKey)!;
      // Only process Income from transactions, expenses come from bank statements
      if (t.type === 'Income') {
        monthData.income += amount;
      }
      // Expenses are now calculated only from bank statements (Debit > 0)
    });

    // Process bank statement credits (הכנסות מהבנק)
    // Group by month based on transaction date (date field) - from 1st of month
    bankCredits.forEach((row: BankStatementRow) => {
      if (!row.date || !row.credit || row.credit <= 0) return;
      
      // Parse date as UTC to avoid timezone issues
      // date is normalized to Date object in the service, but can be null
      let year: number;
      let month: number;
      
      const dateValue = row.date;
      
      if (dateValue instanceof Date) {
        if (isNaN(dateValue.getTime())) {
          this.logger.warn('Invalid date for bank credit:', dateValue);
          return;
        }
        year = dateValue.getUTCFullYear();
        month = dateValue.getUTCMonth() + 1; // getUTCMonth() returns 0-11
      } else {
        // Fallback: if date is not a Date object, try to parse it
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          this.logger.warn('Invalid date for bank credit:', dateValue);
          return;
        }
        year = date.getUTCFullYear();
        month = date.getUTCMonth() + 1;
      }
      
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const creditAmount = row.credit || 0;
      
      // Initialize month if not exists
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { income: 0, expense: 0 });
      }
      
      // Add credit to income for this month
      const monthData = monthMap.get(monthKey)!;
      monthData.income += creditAmount;
      
      // Debug log to verify credits are being added
      this.logger.debug('Added bank credit to income', {
        monthKey,
        creditAmount,
        totalIncome: monthData.income,
        description: row.description
      });
    });

    // Process bank statement debits (הוצאות מהבנק)
    // Group by month based on transaction date (date field) - from 1st of month
    bankDebits.forEach((row: BankStatementRow) => {
      if (!row.date || !row.debit || row.debit <= 0) return;
      
      // Parse date as UTC to avoid timezone issues
      // date is normalized to Date object in the service, but can be null
      let year: number;
      let month: number;
      
      const dateValue = row.date;
      
      if (dateValue instanceof Date) {
        if (isNaN(dateValue.getTime())) {
          this.logger.warn('Invalid date for bank debit:', dateValue);
          return;
        }
        year = dateValue.getUTCFullYear();
        month = dateValue.getUTCMonth() + 1; // getUTCMonth() returns 0-11
      } else {
        // Fallback: if date is not a Date object, try to parse it
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          this.logger.warn('Invalid date for bank debit:', dateValue);
          return;
        }
        year = date.getUTCFullYear();
        month = date.getUTCMonth() + 1;
      }
      
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const debitAmount = row.debit || 0;
      
      // Initialize month if not exists
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { income: 0, expense: 0 });
      }
      
      // Add debit to expense for this month
      const monthData = monthMap.get(monthKey)!;
      monthData.expense += debitAmount;
      
      // Debug log to verify debits are being added
      this.logger.debug('Added bank debit to expense', {
        monthKey,
        debitAmount,
        totalExpense: monthData.expense,
        description: row.description
      });
    });

    // Sort months chronologically (descending - newest first)
    const sortedMonths = Array.from(monthMap.keys()).sort().reverse();
    return sortedMonths.map(monthKey => {
      const [year, month] = monthKey.split('-');
      const data = monthMap.get(monthKey)!;
      // Format as MM/yyyy - month and year only
      return {
        date: `${month}/${year}`, // Format: MM/yyyy
        income: data.income,
        expense: data.expense
      };
    });
  });

  maxLineChartValue = computed(() => {
    const data = this.lineChartData();
    if (data.length === 0) {
      return 1; // Avoid division by zero
    }
    return Math.max(...data.map((d: { date: string; income: number; expense: number }) => Math.max(d.income, d.expense)));
  });

  private destroy$ = new Subject<void>();
  private lastDateRange: { start: Date; end: Date } | null = null;
  private isInitialized = false;

  constructor(
    private transactionService: TransactionService,
    private settingsService: UserSettingsService,
    private categoryService: CategoryService,
    private bankStatementService: BankStatementService,
    private transactionHelper: TransactionHelperService,
    private router: Router,
    private logger: LoggerService
  ) {
    // Effect to reload transactions when settings or month changes
    // Skip during initial load to prevent duplicate calls
    effect(() => {
      if (!this.isInitialized) {
        return; // Skip effect during initialization
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

    // Charts are computed signals, they update automatically
  }

  ngOnInit(): void {
    // Load all transactions to populate available months
    this.transactionService.loadAllTransactionsForMonths();
    
    // Load transactions for current date range
    const { start, end } = this.dateRange();
    this.lastDateRange = { start, end };
    this.loadTransactions(start, end);
    
    // Load categories
    this.loadCategories();
    
    // Load credit transactions from bank statements
    this.loadCreditTransactions();
    
    // Mark as initialized after a short delay to allow effect to work for future changes
    setTimeout(() => {
      this.isInitialized = true;
    }, 100);
    
    // Reload when navigating back to dashboard
    this.router.events
      .pipe(
        filter((event: Event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => {
        const url = event.url || event.urlAfterRedirects || '';
        if (url.includes('/dashboard') || url === '/' || url === '') {
          const { start, end } = this.dateRange();
          const allTransactions = this.allTransactions();
          const currentTransactions = this.transactions();
          
          // Only load if we don't have transactions for current range
          if (allTransactions.length === 0 || currentTransactions.length === 0) {
            this.loadTransactions(start, end);
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadTransactions(start?: Date, end?: Date): void {
    const dateRange = start && end ? { start, end } : this.dateRange();
    
    this.transactionService.getTransactions(dateRange.start, dateRange.end).subscribe({
      error: (error: unknown) => {
        this.logger.error('Error loading transactions', error);
      }
    });
  }

  loadCategories(): void {
    this.categoriesLoading.set(true);
    this.categoryService.getCategories().subscribe({
      next: (categories: Category[]) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);
      },
      error: () => {
        this.categoriesLoading.set(false);
      }
    });
  }

  loadCreditTransactions(): void {
    this.bankTransactionsLoading.set(true);
    this.bankStatementService.getCreditTransactions().subscribe({
      next: (statement: BankStatement | null) => {
        this.bankStatement.set(statement || null);
        this.bankTransactionsLoading.set(false);
      },
      error: (error: unknown) => {
        this.logger.error('Error loading bank statement', error);
        this.bankStatement.set(null);
        this.bankTransactionsLoading.set(false);
      }
    });
  }


  getIncomeBarWidth(income: number): number {
    if (income <= 0) {
      return 0;
    }
    const maxValue = this.maxLineChartValue();
    return Math.min((income / maxValue) * 100, 100);
  }

  getExpenseBarWidth(expense: number): number {
    if (expense <= 0) {
      return 0;
    }
    const maxValue = this.maxLineChartValue();
    return Math.min((expense / maxValue) * 100, 100);
  }

  // Pie Chart SVG Path Calculation
  getPieSlicePath(item: { name: string; amount: number; color: string }, index: number): string {
    const data = this.pieChartData();
    const total = this.totalExpensesForPieChart(); // Use transactions total, not bank debits
    if (total === 0 || !item.amount) return '';
    
    const radius = 100; // Increased from 80 to make slices larger
    const centerX = 0;
    const centerY = 0;
    let cumulativePercentage = 0;
    
    // Calculate cumulative percentage up to this slice
    for (let i = 0; i < index; i++) {
      cumulativePercentage += (data[i].amount / total) * 100;
    }
    
    const percentage = (item.amount / total) * 100;
    const startAngle = (cumulativePercentage / 100) * 360 - 90; // Start from top (-90 degrees)
    const endAngle = ((cumulativePercentage + percentage) / 100) * 360 - 90;
    
    // Convert angles to radians
    const startRad = startAngle * (Math.PI / 180);
    const endRad = endAngle * (Math.PI / 180);
    
    // Calculate points on circle
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    // Large arc flag (1 if angle > 180, 0 otherwise)
    const largeArcFlag = percentage > 50 ? 1 : 0;
    
    // Create path: Move to center, line to start point, arc to end point, close path
    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  }
  
  onPieChartClick(event: MouseEvent): void {
    const target = event.target as SVGPathElement;
    if (target && target.classList.contains('pie-slice')) {
      const categoryName = target.getAttribute('data-category');
      if (categoryName) {
        this.onCategoryClick(categoryName);
      }
    }
  }
  
  onPieSliceHover(item: { name: string; amount: number; color: string }, event: MouseEvent): void {
    const target = event.target as SVGPathElement;
    if (target) {
      this.highlightSlice(target);
      // Also highlight the corresponding legend item
      this.highlightLegendItem(item.name);
    }
  }

  onPieSliceLeave(): void {
    this.resetAllSlices();
    this.resetAllLegendItems();
  }

  onLegendItemHover(categoryName: string, index: number): void {
    // Find the slice by category name
    const slice = document.querySelector(`.pie-slice[data-category="${categoryName}"]`) as SVGPathElement;
    if (slice) {
      this.highlightSlice(slice);
    }
    // Also highlight the legend item
    this.highlightLegendItem(categoryName);
  }

  onLegendItemLeave(): void {
    this.resetAllSlices();
    this.resetAllLegendItems();
  }

  private highlightSlice(slice: SVGPathElement): void {
    if (slice) {
      slice.style.opacity = '0.8';
      slice.style.transform = 'scale(1.05)';
      slice.style.transformOrigin = 'center';
    }
  }

  private highlightLegendItem(categoryName: string): void {
    const legendItem = document.querySelector(`.legend-item[data-category="${categoryName}"]`) as HTMLElement;
    if (legendItem) {
      legendItem.style.transform = 'translateX(-0.5rem) scale(1.05)';
      legendItem.style.backgroundColor = 'var(--color-surface)';
      legendItem.style.boxShadow = 'var(--shadow-md)';
    }
  }

  private resetAllSlices(): void {
    // Reset all slices
    const slices = document.querySelectorAll('.pie-slice');
    slices.forEach(slice => {
      (slice as SVGPathElement).style.opacity = '1';
      (slice as SVGPathElement).style.transform = 'scale(1)';
    });
  }

  private resetAllLegendItems(): void {
    // Reset all legend items
    const legendItems = document.querySelectorAll('.legend-item');
    legendItems.forEach(item => {
      (item as HTMLElement).style.transform = '';
      (item as HTMLElement).style.backgroundColor = '';
      (item as HTMLElement).style.boxShadow = '';
    });
  }
  
  onCategoryClick(categoryName: string): void {
    // Drill-down functionality - navigate to transactions with filter
    this.router.navigate(['/transactions/expenses'], {
      queryParams: { category: categoryName }
    });
  }

  navigateToTransactions(): void {
    this.router.navigate(['/transactions/expenses']);
  }

  navigateToIncomes(): void {
    this.router.navigate(['/transactions/incomes']);
  }

  navigateToBankStatements(): void {
    this.router.navigate(['/bank-statements']);
  }

  private generateColorFromName(name: string, usedColors: Set<string>): string {
    // Generate a color based on name hash
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate HSL color with fixed saturation and lightness for soft colors
    const hue = Math.abs(hash) % 360;
    const saturation = 70; // Soft saturation
    const lightness = 75; // Light tone
    
    // Convert HSL to RGB
    const h = hue / 360;
    const s = saturation / 100;
    const l = lightness / 100;
    
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    const color = `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    
    // If still duplicate, try with different lightness
    if (usedColors.has(color)) {
      return this.generateColorFromName(name + '1', usedColors);
    }
    
    return color;
  }
}

