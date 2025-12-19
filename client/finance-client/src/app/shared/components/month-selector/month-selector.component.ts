import { Component, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../../core/services/transaction.service';
import { UserSettingsService } from '../../../core/services/user-settings.service';

@Component({
  selector: 'app-month-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './month-selector.component.html',
  styleUrl: './month-selector.component.scss'
})
export class MonthSelectorComponent implements OnInit {
  // רשימה קבועה של 12 חודשים אחורה (כולל החודש הנוכחי)
  // משתמש ב-UTC כדי להיות עקבי עם חישוב החודש של העסקאות
  availableMonths = computed(() => {
    const now = new Date();
    const months: Date[] = [];
    
    // יצירת רשימה של 12 החודשים האחרונים
    // Use UTC to be consistent with transaction month calculation
    for (let i = 0; i < 12; i++) {
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();
      const monthOffset = currentMonth - i;
      
      // Calculate year and month, handling year rollover
      let year = currentYear;
      let month = monthOffset;
      
      // If month is negative, go to previous year
      if (month < 0) {
        year = currentYear - 1;
        month = 12 + month; // month is negative, so this adds correctly
      }
      
      // Create date in UTC
      const monthDate = new Date(Date.UTC(year, month, 1));
      months.push(monthDate);
    }
    
    return months;
  });

  // בדיקה אם לחודש יש עסקאות
  // חשוב: בודק לאיזה חודש (לפי ההגדרות) העסקה שייכת, לא רק את החודש של התאריך
  // 
  // מצב "מתחילת החודש": עסקה ב-7 בנובמבר שייכת לנובמבר (1.11 - 30.11)
  // מצב "מהעשירי לחודש": עסקה ב-7 בנובמבר שייכת לאוקטובר (10.10 - 09.11)
  // 
  // הקוד תומך בשני המצבים ומתעדכן אוטומטית כשההגדרה משתנה
  monthHasTransactions = computed(() => {
    const transactions = this.transactionService.transactions();
    const dateRangeType = this.settingsService.dateRangeType();
    const monthSet = new Set<string>();
    
    transactions.forEach(t => {
      const dateValue = t?.transactionDate || t?.date;
      if (t && dateValue) {
        const transactionDate = new Date(dateValue);
        
        // Find which month this transaction belongs to based on date range type
        // This handles both "month-start" and "month-10th" correctly
        const month = this.getMonthForTransaction(transactionDate, dateRangeType);
        if (month) {
          const year = month.getUTCFullYear();
          const monthIndex = month.getUTCMonth(); // 0-11
          const monthKey = `${year}-${monthIndex}`;
          monthSet.add(monthKey);
        }
      }
    });
    
    return monthSet;
  });

  // Helper method to determine which month a transaction belongs to based on date range type
  // תומך בשני מצבים:
  // 1. "month-start": מה-1 לחודש ועד לתאריך האחרון באותו חודש
  // 2. "month-10th": מה-10 לחודש ועד ל-9 בחודש שאחריו
  private getMonthForTransaction(transactionDate: Date, dateRangeType: string): Date | null {
    const year = transactionDate.getUTCFullYear();
    const month = transactionDate.getUTCMonth();
    const day = transactionDate.getUTCDate();
    
    if (dateRangeType === 'month-start') {
      // מצב "מתחילת החודש": העסקה שייכת לחודש שבו היא נמצאת
      // דוגמה: עסקה ב-7 בנובמבר → שייכת לנובמבר (1.11 - 30.11)
      // דוגמה: עסקה ב-25 בדצמבר → שייכת לדצמבר (1.12 - 31.12)
      return new Date(Date.UTC(year, month, 1));
    } else if (dateRangeType === 'month-10th') {
      // מצב "מהעשירי לחודש": העסקה שייכת לחודש שבו חל ה-10 של הטווח
      // טווח של חודש X: 10.X - 09.(X+1)
      // 
      // אם העסקה בין 1-9 לחודש → היא בטווח של החודש הקודם (10.(X-1) - 09.X)
      // דוגמה: עסקה ב-7 בנובמבר → בטווח של אוקטובר (10.10 - 09.11)
      // 
      // אם העסקה בין 10-31 לחודש → היא בטווח של החודש הזה (10.X - 09.(X+1))
      // דוגמה: עסקה ב-15 בנובמבר → בטווח של נובמבר (10.11 - 09.12)
      // דוגמה: עסקה ב-5 בדצמבר → בטווח של נובמבר (10.11 - 09.12)
      
      if (day < 10) {
        // העסקה בטווח של החודש הקודם
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        return new Date(Date.UTC(prevYear, prevMonth, 1));
      } else {
        // העסקה בטווח של החודש הזה
        return new Date(Date.UTC(year, month, 1));
      }
    } else {
      // Fallback: אם יש מצב לא מוכר, נשתמש ב-month-start
      return new Date(Date.UTC(year, month, 1));
    }
  }

  // בדיקה אם חודש מסוים יש לו עסקאות
  // משתמש ב-UTC כדי למנוע בעיות אזור זמן
  hasTransactionsForMonth(month: Date): boolean {
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();
    const monthKey = `${year}-${monthIndex}`;
    return this.monthHasTransactions().has(monthKey);
  }

  // Get the actual selected month value for display
  selectedMonthValue = computed(() => {
    const month = this.settingsService.selectedMonth();
    // If null, return the month that represents the current date range
    if (!month) {
      return this.settingsService.getCurrentRangeMonth();
    }
    return month;
  });

  // Computed signal for the selected month index in the dropdown
  // This ensures the dropdown updates reactively when settings change
  selectedMonthIndex = computed(() => {
    const selectedMonth = this.selectedMonthValue();
    const months = this.availableMonths();
    
    const selectedYear = selectedMonth.getUTCFullYear();
    const selectedMonthIndex = selectedMonth.getUTCMonth();
    
    // Find the index of the matching month
    const index = months.findIndex(m => {
      return m.getUTCFullYear() === selectedYear && m.getUTCMonth() === selectedMonthIndex;
    });
    
    if (index >= 0) {
      return index.toString();
    }
    
    // If not found, try to find the current range month instead
    const currentRangeMonth = this.settingsService.getCurrentRangeMonth();
    const currentYear = currentRangeMonth.getUTCFullYear();
    const currentMonthIndex = currentRangeMonth.getUTCMonth();
    
    const currentIndex = months.findIndex(m => {
      return m.getUTCFullYear() === currentYear && m.getUTCMonth() === currentMonthIndex;
    });
    
    return currentIndex >= 0 ? currentIndex.toString() : '0';
  });

  dateRangeString = computed(() => {
    const month = this.settingsService.selectedMonth();
    return this.settingsService.getDateRangeString(month || undefined);
  });


  constructor(
    private transactionService: TransactionService,
    private settingsService: UserSettingsService
  ) {}

  ngOnInit(): void {
    // Settings are already loaded in UserSettingsService constructor
    // Only load if not already loaded to prevent duplicate calls
    // (loadSettings() has internal protection, but we skip it here since it's already called)
    
    // Load all transactions to populate available months
    // This ensures we have all months available even if dashboard only loaded a subset
    // (loadAllTransactionsForMonths() has internal protection against duplicates)
    this.transactionService.loadAllTransactionsForMonths();
  }

  onMonthChangeSelect(index: string): void {
    const monthIndex = parseInt(index, 10);
    const months = this.availableMonths();
    if (monthIndex >= 0 && monthIndex < months.length) {
      const month = months[monthIndex];
      this.settingsService.updateSettings({ selectedMonth: month });

      // Force refresh transactions for the newly selected month to ensure the API is called
      // This avoids missing the effect when selection happens early or during a refresh
      try {
        const { start, end } = this.settingsService.getDateRange(month);
        // Use refreshTransactions to replace transactions in the selected date range
        this.transactionService.refreshTransactions(start, end).subscribe({
          next: () => {
            // No-op - signal will update automatically
          },
          error: (err) => {
            // Log a debug message if refresh fails (non-blocking)
            console.debug('MonthSelector: refreshTransactions failed', err);
          }
        });
      } catch (e) {
        console.debug('MonthSelector: failed to trigger refresh', e);
      }
    }
  }

  formatMonth(month: Date): string {
    return month.toLocaleDateString('he-IL', { year: 'numeric', month: 'long' });
  }

  // בדיקה אם זה החודש הנוכחי לפי ההגדרה
  // משתמש ב-UTC כדי להיות עקבי
  isCurrentRangeMonth(month: Date): boolean {
    const currentRangeMonth = this.settingsService.getCurrentRangeMonth();
    return month.getUTCFullYear() === currentRangeMonth.getUTCFullYear() && 
           month.getUTCMonth() === currentRangeMonth.getUTCMonth();
  }

}

