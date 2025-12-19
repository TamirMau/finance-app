import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

export type DateRangeType = 'month-start' | 'month-10th';

export interface UserSettings {
  dateRangeType: DateRangeType;
  selectedMonth: Date | null; // null = current month
  showHalves: boolean; // Show halves column and summary card
}

interface UserSettingsDto {
  dateRangeType: string;
  selectedMonth: string | null;
  showHalves: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserSettingsService {
  private apiUrl = `${environment.apiBaseUrl}/api/settings`;
  
  // Default settings
  private defaultSettings: UserSettings = {
    dateRangeType: 'month-start',
    selectedMonth: null,
    showHalves: false
  };

  // Signal for settings
  private _settings = signal<UserSettings>(this.defaultSettings);
  public settings = this._settings.asReadonly();

  // Computed signals for date range
  public dateRangeType = computed(() => this._settings().dateRangeType);
  public selectedMonth = computed(() => this._settings().selectedMonth);
  public showHalves = computed(() => this._settings().showHalves);

  // Flag to prevent duplicate loading
  private isLoadingSettings = false;
  private hasLoadedSettings = false;

  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) {
    // Load settings if user is authenticated
    if (this.isAuthenticated()) {
      // Use setTimeout to avoid loading during construction
      setTimeout(() => this.loadSettings(), 0);
    }
  }

  private isAuthenticated(): boolean {
    // Check token directly to avoid circular dependency
    return !!localStorage.getItem('token');
  }

  loadSettings(): void {
    // Prevent duplicate calls
    if (this.isLoadingSettings) {
      return;
    }

    // Only load if user is authenticated
    if (!this.isAuthenticated()) {
      this._settings.set({ ...this.defaultSettings });
      return;
    }

    this.isLoadingSettings = true;

    this.http.get<UserSettingsDto>(this.apiUrl).subscribe({
      next: (dto) => {
        // First, set the dateRangeType so getCurrentRangeMonth() works correctly
        const dateRangeType = (dto.dateRangeType as DateRangeType) || 'month-start';
        const tempSettings: UserSettings = {
          dateRangeType: dateRangeType,
          selectedMonth: dto.selectedMonth ? new Date(dto.selectedMonth) : null,
          showHalves: dto.showHalves !== undefined ? dto.showHalves : false
        };
        
        // Temporarily set settings to get correct current range month
        this._settings.set(tempSettings);
        
        // Get current range month to compare (now with correct dateRangeType)
        const currentRangeMonth = this.getCurrentRangeMonth();
        
        // On initial load after login, always reset to current month
        // This ensures users see the current month when they first log in
        // If this is not the first load (hasLoadedSettings is true), keep the saved month
        let finalSelectedMonth: Date;
        if (!this.hasLoadedSettings) {
          // First load after login - always use current month
          finalSelectedMonth = currentRangeMonth;
        } else {
          // Subsequent loads - use saved month or current month if none saved
          finalSelectedMonth = tempSettings.selectedMonth || currentRangeMonth;
        }
        
        // Set final settings
        const finalSettings: UserSettings = {
          dateRangeType: dateRangeType,
          selectedMonth: finalSelectedMonth,
          showHalves: tempSettings.showHalves
        };
        
        // Check if settings actually changed before saving
        const currentSettings = this._settings();
        const settingsChanged = 
          currentSettings.dateRangeType !== finalSettings.dateRangeType ||
          (currentSettings.selectedMonth?.getTime() !== finalSettings.selectedMonth?.getTime()) ||
          currentSettings.showHalves !== finalSettings.showHalves;
        
        this._settings.set(finalSettings);
        this.hasLoadedSettings = true;
        this.isLoadingSettings = false;
        
        // Only save if settings changed (not on initial load if they match)
        if (settingsChanged) {
          this.saveSettings(finalSettings);
        }
      },
      error: (error) => {
        this.isLoadingSettings = false;
        // If 404, the endpoint might not exist yet - use defaults silently
        // For other errors, log but still use defaults
        if (error.status !== 404) {
          this.logger.error('Error loading settings', error);
        }
        // Always use default settings on error
        const defaultSettings = { ...this.defaultSettings };
        // Set current range month as default if no month is selected
        if (!defaultSettings.selectedMonth) {
          defaultSettings.selectedMonth = this.getCurrentRangeMonth();
        }
        this._settings.set(defaultSettings);
        this.hasLoadedSettings = true;
      }
    });
  }

  updateSettings(settings: Partial<UserSettings>): void {
    const current = this._settings();
    const updated = { ...current, ...settings };
    this._settings.set(updated);
    this.saveSettings(updated);
  }

  private saveSettings(settings: UserSettings): void {
    const dto: UserSettingsDto = {
      dateRangeType: settings.dateRangeType,
      selectedMonth: settings.selectedMonth ? settings.selectedMonth.toISOString() : null,
      showHalves: settings.showHalves
    };

    this.http.put<UserSettingsDto>(this.apiUrl, dto).subscribe({
      next: (response) => {
        // Settings saved successfully
        const updated: UserSettings = {
          dateRangeType: (response.dateRangeType as DateRangeType) || 'month-start',
          selectedMonth: response.selectedMonth ? new Date(response.selectedMonth) : null,
          showHalves: response.showHalves !== undefined ? response.showHalves : false
        };
        this._settings.set(updated);
      },
      error: (error) => {
        this.logger.error('Error saving settings', error);
        // Revert to previous settings on error
        this.loadSettings();
      }
    });
  }

  // Calculate date range based on settings and selected month
  // Returns dates with exact times as specified: start at 00:00:01, end at 23:59:59
  getDateRange(month?: Date): { start: Date; end: Date } {
    const dateRangeType = this._settings().dateRangeType;
    let targetMonth: Date;
    
    // If month is provided, use it; otherwise use selectedMonth or current date
    if (month) {
      // Use UTC for consistency
      targetMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    } else {
      const selectedMonth = this._settings().selectedMonth;
      if (selectedMonth) {
        // Use UTC for consistency
        targetMonth = new Date(Date.UTC(selectedMonth.getUTCFullYear(), selectedMonth.getUTCMonth(), 1));
      } else {
        // For current month, need to calculate based on date range type
        targetMonth = this.getCurrentRangeMonth();
      }
    }
    
    let start: Date;
    let end: Date;

    // Use UTC for consistency
    const targetYear = targetMonth.getUTCFullYear();
    const targetMonthIndex = targetMonth.getUTCMonth();

    if (dateRangeType === 'month-start') {
      // מצב "מתחילת החודש": מה-1 לחודש ועד לתאריך האחרון באותו חודש
      start = new Date(Date.UTC(targetYear, targetMonthIndex, 1, 0, 0, 0, 0));
      end = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0, 23, 59, 59, 999));
    } else {
      // מצב "מהעשירי לחודש": מה-10 לחודש בשעה 00:00:01 ועד ל-9 בחודש שאחריו בשעה 23:59:59
      // Note: We use 00:00:00 for start to ensure all transactions on the 10th are included
      // (transactions are typically stored at 00:00:00). The conceptual start is 00:00:01.
      start = new Date(Date.UTC(targetYear, targetMonthIndex, 10, 0, 0, 0, 0));
      end = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 9, 23, 59, 59, 999));
    }

    return { start, end };
  }

  // Get formatted date range string for display
  getDateRangeString(month?: Date): string {
    const { start, end } = this.getDateRange(month);
    const startStr = this.formatDate(start);
    const endStr = this.formatDate(end);
    return `${startStr} – ${endStr}`;
  }

  // Format date as dd/MM/yyyy
  // Uses UTC methods for consistency with date range calculations
  private formatDate(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  // Get the month that represents the current date range (for display in month selector)
  // החודש הנוכחי = החודש שבו חל ה-10 (למצב "מהעשירי לחודש")
  // משתמש ב-UTC כדי להיות עקבי עם חישוב החודש של העסקאות
  getCurrentRangeMonth(): Date {
    const dateRangeType = this._settings().dateRangeType;
    const now = new Date();
    
    if (dateRangeType === 'month-start') {
      // מצב "מתחילת החודש": החודש הנוכחי = החודש שבו אנו נמצאים בפועל
      // Use UTC to be consistent with transaction month calculation
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      return new Date(Date.UTC(year, month, 1));
    } else {
      // מצב "מהעשירי לחודש": החודש הנוכחי = החודש שבו חל ה-10
      // אם היום לפני ה-10 → החודש הנוכחי הוא החודש הקודם
      // אם היום ב-10 או אחרי → החודש הנוכחי הוא החודש הזה
      // Use UTC to be consistent
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const day = now.getUTCDate();
      
      if (day < 10) {
        // דוגמה: אם היום 8 בדצמבר → החודש הנוכחי הוא נובמבר
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        return new Date(Date.UTC(prevYear, prevMonth, 1));
      } else {
        // דוגמה: אם היום 15 בדצמבר → החודש הנוכחי הוא דצמבר
        return new Date(Date.UTC(year, month, 1));
      }
    }
  }

  // Reset to default
  resetSettings(): void {
    const defaultSettings = { ...this.defaultSettings };
    this._settings.set(defaultSettings);
    this.saveSettings(defaultSettings);
  }

  // Clear cache and reset to defaults (called on logout or user change)
  clearCache(): void {
    const defaultSettings = { ...this.defaultSettings };
    this._settings.set(defaultSettings);
    this.isLoadingSettings = false;
    this.hasLoadedSettings = false;
  }

  /**
   * Filter transactions by date range using UTC for accurate timezone handling
   * @param transactions Array of transactions to filter
   * @param start Start date of the range
   * @param end End date of the range
   * @returns Filtered transactions within the date range
   */
  filterTransactionsByDateRange<T extends { transactionDate?: string | Date; assignedMonthDate?: string | Date; date?: string | Date }>(
    transactions: T[],
    start: Date,
    end: Date
  ): T[] {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Get the selected month from settings to compare with assignedMonthDate
    const selectedMonth = this._settings().selectedMonth;
    
    // Extract target month (year and month index) from selectedMonth
    // If selectedMonth is not set, we need to extract the month from the date range
    // For month-10th, start is on the 10th, so we need to get the month from start
    // For month-start, start is on the 1st, so we can use start directly
    let targetYear: number;
    let targetMonthIndex: number;
    
    if (selectedMonth) {
      // Use selectedMonth directly - it represents the month the user selected
      targetYear = selectedMonth.getUTCFullYear();
      targetMonthIndex = selectedMonth.getUTCMonth();
    } else {
      // Fallback: extract from start date
      // For month-10th, start is on the 10th of the target month, so start.getUTCMonth() is correct
      // For month-start, start is on the 1st of the target month, so start.getUTCMonth() is correct
      targetYear = start.getUTCFullYear();
      targetMonthIndex = start.getUTCMonth();
    }
    
    return transactions.filter(t => {
      if (!t) return false;
      
      // Check if transaction has assignedMonthDate
      const assignedMonthDateValue = (t as any).assignedMonthDate;
      
      if (assignedMonthDateValue) {
        // If assignedMonthDate exists, compare by month (not by exact date)
        // This is because assignedMonthDate is set to the 1st of the month when uploading
        // but we want to match it to the selected month regardless of the date range type
        
        // IMPORTANT: Parse the date as UTC to avoid timezone issues
        // The server sends dates like "2025-12-01T00:00:00" which should be treated as UTC
        let assignedYear: number;
        let assignedMonth: number;
        
        if (assignedMonthDateValue instanceof Date) {
          assignedYear = assignedMonthDateValue.getUTCFullYear();
          assignedMonth = assignedMonthDateValue.getUTCMonth();
        } else if (typeof assignedMonthDateValue === 'string') {
          // Parse the string manually to avoid timezone issues
          // Format: "2025-12-01T00:00:00" or "2025-12-01T00:00:00Z" or ISO format
          const dateStr = assignedMonthDateValue.trim();
          
          // If it ends with 'Z', it's already UTC
          if (dateStr.endsWith('Z')) {
            const assignedDate = new Date(dateStr);
            if (isNaN(assignedDate.getTime())) {
              return false;
            }
            assignedYear = assignedDate.getUTCFullYear();
            assignedMonth = assignedDate.getUTCMonth();
          } else {
            // Parse as UTC manually: "2025-12-01T00:00:00" -> UTC date
            // Extract year, month, day from the string
            const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
              assignedYear = parseInt(match[1], 10);
              assignedMonth = parseInt(match[2], 10) - 1; // Month is 0-indexed
            } else {
              // Fallback: try to parse as Date (may have timezone issues)
              const assignedDate = new Date(dateStr);
              if (isNaN(assignedDate.getTime())) {
                return false;
              }
              assignedYear = assignedDate.getUTCFullYear();
              assignedMonth = assignedDate.getUTCMonth();
            }
          }
        } else {
          // Try to convert to string first
          const assignedDate = new Date(String(assignedMonthDateValue));
          if (isNaN(assignedDate.getTime())) {
            return false;
          }
          assignedYear = assignedDate.getUTCFullYear();
          assignedMonth = assignedDate.getUTCMonth();
        }
        
        // Match if year and month match the target month
        // IMPORTANT: When using assignedMonthDate, we compare by month only,
        // regardless of dateRangeType (month-start or month-10th)
        // This is because assignedMonthDate represents the month the transaction belongs to,
        // not the date range it falls into
        const matches = assignedYear === targetYear && assignedMonth === targetMonthIndex;
        
        return matches;
      }
      
      // Fallback: use transactionDate or date and check if within range
      const dateValue = (t as any).transactionDate || (t as any).date;
      if (!dateValue) return false;
      const transactionDate = dateValue instanceof Date ? dateValue : new Date(dateValue);

      // Check if date is valid
      if (isNaN(transactionDate.getTime())) {
        return false;
      }

      // Use UTC for date comparison to avoid timezone issues
      // Compare dates only (ignore time) - transactions are date-only
      const tYear = transactionDate.getUTCFullYear();
      const tMonth = transactionDate.getUTCMonth();
      const tDay = transactionDate.getUTCDate();
      
      // Get start and end dates (extract date components only for comparison)
      const startYear = start.getUTCFullYear();
      const startMonth = start.getUTCMonth();
      const startDay = start.getUTCDate();
      
      const endYear = end.getUTCFullYear();
      const endMonth = end.getUTCMonth();
      const endDay = end.getUTCDate();
      
      // Compare dates: transaction date must be >= start date and <= end date
      // Create date objects at start of day for comparison
      const tDate = new Date(Date.UTC(tYear, tMonth, tDay, 0, 0, 0, 0));
      const startDate = new Date(Date.UTC(startYear, startMonth, startDay, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(endYear, endMonth, endDay, 0, 0, 0, 0));
      
      // Check if transaction date is within range (inclusive)
      // Since transactions are date-only, we compare dates at start of day
      return tDate.getTime() >= startDate.getTime() && tDate.getTime() <= endDate.getTime();
    });
  }
}

