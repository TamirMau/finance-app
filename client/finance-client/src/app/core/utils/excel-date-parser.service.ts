import { Injectable } from '@angular/core';
import { LoggerService } from '../services/logger.service';

/**
 * Service for parsing dates from Excel files
 * Handles multiple date formats commonly found in Israeli credit card and bank statements:
 * - Excel date serial numbers
 * - DD/MM/YYYY format (Isracard)
 * - D/M/YY format (CAL/Isracard with 2-digit year)
 * - DD.MM.YY format (with dots)
 * - YYYY-MM-DD format
 * 
 * Returns ISO string format for consistency
 */
@Injectable({
  providedIn: 'root'
})
export class ExcelDateParserService {
  
  constructor(private logger: LoggerService) {}

  /**
   * Parse a date value from Excel data
   * Handles Date objects, Excel serial numbers, and string formats
   * Returns ISO string or null if parsing fails
   */
  parseDate(dateValue: any): string | null {
    if (!dateValue) {
      const now = new Date();
      return now.toISOString();
    }
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      if (isNaN(dateValue.getTime())) {
        this.logger.warn('Invalid Date object provided to parseDate', { dateValue });
        return new Date().toISOString();
      }
      return dateValue.toISOString();
    }
    
    // If it's a number (Excel date serial number)
    if (typeof dateValue === 'number') {
      // Excel date serial number (days since 1899-12-30)
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
      if (isNaN(date.getTime())) {
        this.logger.warn('Invalid Excel serial number', { dateValue });
        return new Date().toISOString();
      }
      return date.toISOString();
    }
    
    // If it's a string, try parsing various formats
    if (typeof dateValue === 'string') {
      return this.parseDateString(dateValue);
    }
    
    // Unknown type, return current date
    this.logger.warn('Unknown date type in parseDate', { dateValue, type: typeof dateValue });
    return new Date().toISOString();
  }

  /**
   * Parse a date string with multiple format support
   * Returns ISO string or null if parsing fails
   */
  private parseDateString(dateStr: string): string {
    const trimmed = dateStr.trim();
    
    // Helper function to create UTC date and return ISO string
    const createUTCDate = (year: number, month: number, day: number): string => {
      // Create date in UTC to avoid timezone issues
      const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
      this.logger.warn('Invalid date components', { year, month, day });
      return new Date().toISOString();
    };
    
    // Format 1: Isracard format - DD/MM/YYYY (4-digit year) - check this FIRST
    const isracardFormat = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const isracardMatch = trimmed.match(isracardFormat);
    if (isracardMatch) {
      const [, day, month, year] = isracardMatch;
      return createUTCDate(parseInt(year), parseInt(month), parseInt(day));
    }
    
    // Format 2: CAL/Isracard format - D/M/YY or DD/MM/YY (single or double digit day/month, 2-digit year)
    const calFormat1 = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
    const calMatch1 = trimmed.match(calFormat1);
    if (calMatch1) {
      const [, day, month, year] = calMatch1;
      // Convert 2-digit year to 4-digit (assuming 2000-2099)
      const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
      return createUTCDate(fullYear, parseInt(month), parseInt(day));
    }
    
    // Format 3: CAL/Isracard format - DD.MM.YY (with dots, 2-digit year)
    const calFormat2 = /^(\d{1,2})\.(\d{1,2})\.(\d{2})$/;
    const calMatch2 = trimmed.match(calFormat2);
    if (calMatch2) {
      const [, day, month, year] = calMatch2;
      const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
      return createUTCDate(fullYear, parseInt(month), parseInt(day));
    }
    
    // Format 4: CAL/Isracard format - DD.MM.YYYY (with dots, 4-digit year)
    const calFormat3 = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
    const calMatch3 = trimmed.match(calFormat3);
    if (calMatch3) {
      const [, day, month, year] = calMatch3;
      return createUTCDate(parseInt(year), parseInt(month), parseInt(day));
    }
    
    // Format 5: YYYY-MM-DD (ISO format)
    const isoFormat = /^(\d{4})-(\d{2})-(\d{2})$/;
    const isoMatch = trimmed.match(isoFormat);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return createUTCDate(parseInt(year), parseInt(month), parseInt(day));
    }
    
    // Format 6: DD/MM/YYYY (alternative format)
    const altFormat1 = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const altMatch1 = trimmed.match(altFormat1);
    if (altMatch1) {
      const [, day, month, year] = altMatch1;
      return createUTCDate(parseInt(year), parseInt(month), parseInt(day));
    }
    
    // Format 7: DD-MM-YYYY (with dashes)
    const altFormat2 = /^(\d{2})-(\d{2})-(\d{4})$/;
    const altMatch2 = trimmed.match(altFormat2);
    if (altMatch2) {
      const [, day, month, year] = altMatch2;
      return createUTCDate(parseInt(year), parseInt(month), parseInt(day));
    }
    
    // Fallback: Try standard Date parsing (but validate result)
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      // Check if the parsed date is reasonable (not year 1900 or 4000+)
      const year = parsed.getFullYear();
      if (year >= 1900 && year <= 2100) {
        return parsed.toISOString();
      }
    }
    
    // If all parsing failed, log warning and return current date
    this.logger.warn('Failed to parse date string, using current date', { dateStr: trimmed });
    return new Date().toISOString();
  }
}
