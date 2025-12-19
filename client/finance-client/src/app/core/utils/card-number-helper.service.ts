import { Injectable } from '@angular/core';

/**
 * Shared utility service for extracting card numbers from file names
 * Used across components to avoid code duplication
 */
@Injectable({
  providedIn: 'root'
})
export class CardNumberHelperService {
  
  /**
   * Extract card number (last 4 digits) from file name
   * Supports multiple patterns:
   * - "מסתיים ב-2753" or "ב-2753" (ends with)
   * - "8354_12_2025" or "4324-max" (4 digits at start)
   * - "כרטיס מאסטרקארד 2753" (after card type)
   * - Any 4-digit number in filename (last resort)
   */
  extractCardNumberFromFileName(fileName: string): string | undefined {
    if (!fileName || !fileName.trim()) {
      return undefined;
    }

    // Pattern 1: "מסתיים ב-2753" or "ב-2753" (ends with)
    const hebrewEndsWithMatch = fileName.match(/[מב]\s*-?\s*(\d{4})/);
    if (hebrewEndsWithMatch) {
      return hebrewEndsWithMatch[1];
    }
    
    // Pattern 2: "8354_12_2025" or "4324-max" - 4 digits at start or before dash/underscore
    const prefixMatch = fileName.match(/^(\d{4})[_-]/);
    if (prefixMatch) {
      return prefixMatch[1];
    }
    
    // Pattern 3: "כרטיס מאסטרקארד 2753" - after card type
    const afterCardTypeMatch = fileName.match(/(?:כרטיס|מאסטרקארד|ויזה|אמריקן)\s+(\d{4})/);
    if (afterCardTypeMatch) {
      return afterCardTypeMatch[1];
    }
    
    // Pattern 4: Any 4-digit number in filename (last resort)
    const any4Digits = fileName.match(/\b(\d{4})\b/);
    if (any4Digits) {
      return any4Digits[1];
    }
    
    return undefined;
  }

  /**
   * Extract last 4 digits from a card number string
   */
  extractLast4Digits(cardNumber: string | null | undefined): string | undefined {
    if (!cardNumber || !cardNumber.trim()) {
      return undefined;
    }

    // Extract only digits
    const digits = cardNumber.replace(/\D/g, '');
    
    if (digits.length >= 4) {
      return digits.substring(digits.length - 4);
    }

    return digits.length > 0 ? digits : undefined;
  }
}

