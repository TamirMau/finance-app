import { Injectable } from '@angular/core';
import { LoggerService } from '../services/logger.service';

/**
 * Utility service for extracting month and year from Excel files
 * Supports multiple formats:
 * 1. A3 = "עסקאות לחיוב ב-10/11/2025: 10,382.64 ₪" -> extract "11/2025"
 * 2. C2 = "דצמבר 2025" -> convert to month/year
 * 3. A3 = "12/2025" -> use as is
 */
@Injectable({
  providedIn: 'root'
})
export class MonthYearExtractorService {
  
  constructor(private logger: LoggerService) {}

  /**
   * Hebrew month names mapping
   */
  private readonly hebrewMonths: { [key: string]: number } = {
    'ינואר': 1,
    'פברואר': 2,
    'מרץ': 3,
    'מרס': 3,
    'אפריל': 4,
    'מאי': 5,
    'יוני': 6,
    'יולי': 7,
    'אוגוסט': 8,
    'ספטמבר': 9,
    'אוקטובר': 10,
    'נובמבר': 11,
    'דצמבר': 12
  };

  /**
   * Extract month and year from Excel worksheet
   * Checks multiple cell locations and formats
   */
  extractMonthYearFromExcel(worksheet: any): { year: number; month: number } | null {
    if (!worksheet) {
      return null;
    }

    // Try A3 first (format 1 and 3)
    const a3Value = this.getCellValue(worksheet, 'A3');
    if (a3Value) {
      const result = this.parseMonthYearFromA3(a3Value);
      if (result) {
        return result;
      }
    }

    // Try C2 (format 2)
    const c2Value = this.getCellValue(worksheet, 'C2');
    if (c2Value) {
      const result = this.parseMonthYearFromC2(c2Value);
      if (result) {
        return result;
      }
    }

    // Try other common locations
    const a2Value = this.getCellValue(worksheet, 'A2');
    if (a2Value) {
      const result = this.parseMonthYearFromA3(a2Value); // Same parsing logic
      if (result) {
        return result;
      }
    }

    return null;
  }

  /**
   * Get cell value from worksheet (handles both XLSX and raw data)
   */
  private getCellValue(worksheet: any, cellAddress: string): string | null {
    try {
      // For XLSX format (from xlsx library)
      if (worksheet[cellAddress]) {
        const cell = worksheet[cellAddress];
        // Check if it has a formatted value (w) or raw value (v)
        if (cell.w) {
          return String(cell.w).trim();
        }
        if (cell.v !== undefined && cell.v !== null) {
          return String(cell.v).trim();
        }
      }
      
      // Try EPPlus style (if using EPPlus on server)
      // This is for reference, client-side uses xlsx library
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse month/year from A3 cell
   * Formats:
   * 1. "עסקאות לחיוב ב-10/11/2025: 10,382.64 ₪" -> extract "11/2025"
   * 2. "12/2025" -> use as is
   * 3. "11/2025" -> use as is
   */
  private parseMonthYearFromA3(value: string): { year: number; month: number } | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();

    // Format 1: Extract from "עסקאות לחיוב ב-10/11/2025: ..."
    // Pattern: look for DD/MM/YYYY or MM/YYYY
    const pattern1 = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
    const match1 = trimmed.match(pattern1);
    if (match1) {
      const day = parseInt(match1[1], 10);
      const month = parseInt(match1[2], 10);
      const year = parseInt(match1[3], 10);
      
      
      if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        return { year, month };
      }
    }

    // Format 2: "MM/YYYY" or "M/YYYY" - exact match
    const pattern2 = /^(\d{1,2})\/(\d{4})$/;
    const match2 = trimmed.match(pattern2);
    if (match2) {
      const month = parseInt(match2[1], 10);
      const year = parseInt(match2[2], 10);
      
      
      if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        return { year, month };
      }
    }

    // Format 3: Look for MM/YYYY anywhere in the string (not just at start/end)
    const pattern3 = /(\d{1,2})\/(\d{4})/g;
    let match3;
    while ((match3 = pattern3.exec(trimmed)) !== null) {
      const month = parseInt(match3[1], 10);
      const year = parseInt(match3[2], 10);
      
      
      if (month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        return { year, month };
      }
    }

    return null;
  }

  /**
   * Parse month/year from C2 cell
   * Format: "דצמבר 2025" -> convert to month/year
   */
  private parseMonthYearFromC2(value: string): { year: number; month: number } | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();

    // Try to find Hebrew month name
    for (const [hebrewMonth, monthNumber] of Object.entries(this.hebrewMonths)) {
      if (trimmed.includes(hebrewMonth)) {
        // Extract year (4 digits)
        const yearMatch = trimmed.match(/(\d{4})/);
        if (yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          if (year >= 2000 && year <= 2100) {
            return { year, month: monthNumber };
          }
        }
      }
    }

    return null;
  }

  /**
   * Extract month and year from raw Excel data (for client-side parsing)
   * This is used when reading Excel files with xlsx library
   */
  extractMonthYearFromRawExcel(allRows: any[]): { year: number; month: number } | null {
    if (!allRows || allRows.length === 0) {
      this.logger.warn('[MonthYearExtractor] allRows is empty');
      return null;
    }

    // Try row 2 (index 2, which is A3 in Excel - 0-indexed)
    if (allRows.length > 2) {
      const row2 = allRows[2];
      if (row2) {
        // Try column 0 (A)
        if (row2[0] !== undefined) {
          const a3Value = String(row2[0]).trim();
          const result = this.parseMonthYearFromA3(a3Value);
          if (result) {
            return result;
          }
        }
        // Also try other columns in row 2 (maybe the data is shifted)
        for (let col = 0; col < 5; col++) {
          if (row2[col] !== undefined) {
            const value = String(row2[col]).trim();
            const result = this.parseMonthYearFromA3(value);
            if (result) {
              return result;
            }
          }
        }
      }
    }

    // Try row 1 (index 1, which is row 2 in Excel - A2 or C2)
    if (allRows.length > 1) {
      const row1 = allRows[1];
      if (row1) {
        // Try column 0 (A) first - A2 format (same as A3 format)
        if (row1[0] !== undefined) {
          const a2Value = String(row1[0]).trim();
          const result = this.parseMonthYearFromA3(a2Value);
          if (result) {
            return result;
          }
        }
        // Try column 2 (C) - C2 format
        if (row1[2] !== undefined) {
          const c2Value = String(row1[2]).trim();
          const result = this.parseMonthYearFromC2(c2Value);
          if (result) {
            return result;
          }
        }
        // Also try other columns in row 1 (check both formats)
        for (let col = 0; col < 5; col++) {
          if (row1[col] !== undefined) {
            const value = String(row1[col]).trim();
            // Try A3 format first (more common)
            const resultA3 = this.parseMonthYearFromA3(value);
            if (resultA3) {
              return resultA3;
            }
            // Then try C2 format
            const resultC2 = this.parseMonthYearFromC2(value);
            if (resultC2) {
              return resultC2;
            }
          }
        }
      }
    }

    // Try row 0 (index 0, which is row 1 in Excel) - sometimes header row has date
    if (allRows.length > 0) {
      const row0 = allRows[0];
      if (row0) {
        for (let col = 0; col < 5; col++) {
          if (row0[col] !== undefined) {
            const value = String(row0[col]).trim();
            const result = this.parseMonthYearFromA3(value) || this.parseMonthYearFromC2(value);
            if (result) {
              return result;
            }
          }
        }
      }
    }

    return null;
  }
}

