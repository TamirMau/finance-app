import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Shared service for date formatting and parsing operations
 * Used across transaction forms to avoid code duplication
 */
@Injectable({
  providedIn: 'root'
})
export class DateHelperService {
  
  /**
   * Format date for display (dd/MM/yyyy)
   */
  formatDateForDisplay(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  /**
   * Parse date from dd/MM/yyyy format
   */
  parseDateFromDisplay(dateString: string): Date | null {
    if (!dateString || !dateString.trim()) return null;
    const parts = dateString.trim().split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) return null;
    return date;
  }
  
  /**
   * Date validator for dd/MM/yyyy format
   * Returns a validator function that can be used in form controls
   */
  dateValidator(): (control: AbstractControl) => ValidationErrors | null {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null; // Let required validator handle empty values
      }
      const date = this.parseDateFromDisplay(control.value);
      if (!date) {
        return { invalidDate: true };
      }
      return null;
    };
  }
  
  /**
   * Handle date picker change (converts YYYY-MM-DD to dd/MM/yyyy)
   */
  onDatePickerChange(event: Event, controlName: string, formGroup: any): void {
    const input = event.target as HTMLInputElement;
    const value = input.value; // This will be in YYYY-MM-DD format from date picker
    
    if (value) {
      // Parse YYYY-MM-DD format
      const dateParts = value.split('-');
      if (dateParts.length === 3) {
        const year = dateParts[0];
        const month = dateParts[1];
        const day = dateParts[2];
        // Convert to dd/MM/yyyy
        const formattedDate = `${day}/${month}/${year}`;
        
        const control = formGroup.get(controlName);
        if (control) {
          // Set the formatted date in the form control (stored as dd/MM/yyyy)
          control.setValue(formattedDate, { emitEvent: true });
          control.markAsTouched();
          
          // Change input type to text and set the formatted value for display (shows dd/MM/yyyy)
          setTimeout(() => {
            input.type = 'text';
            input.value = formattedDate;
            input.readOnly = true; // Prevent manual editing, user must use date picker
          }, 0);
        }
      }
    }
  }
  
  /**
   * Handle date input click - convert back to date type for picker
   */
  onDateInputClick(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.type === 'text' && input.readOnly) {
      input.type = 'date';
      input.readOnly = false;
      // Convert dd/MM/yyyy to YYYY-MM-DD for date picker
      const currentValue = input.value;
      if (currentValue) {
        const date = this.parseDateFromDisplay(currentValue);
        if (date) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          input.value = `${year}-${month}-${day}`;
        }
      }
    }
  }
  
  /**
   * Convert dd/MM/yyyy to YYYY-MM-DD for date input (used when initializing date picker)
   */
  convertToDateInputFormat(dateString: string): string {
    if (!dateString) return '';
    const date = this.parseDateFromDisplay(dateString);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Get date value for date input (converts dd/MM/yyyy to YYYY-MM-DD)
   */
  getDateInputValue(dateString: string): string {
    return this.convertToDateInputFormat(dateString);
  }
  
  /**
   * Get input type for date field - text if editing with value, date otherwise
   */
  getDateInputType(controlName: string, formGroup: any, isEdit: boolean): string {
    const control = formGroup.get(controlName);
    if (isEdit && control?.value) {
      // Check if value is in DD/MM/YYYY format (contains /)
      if (control.value.includes('/')) {
        return 'text';
      }
    }
    return 'date';
  }
  
  /**
   * Get readOnly state for date field
   */
  getDateReadOnly(controlName: string, formGroup: any, isEdit: boolean): boolean {
    const control = formGroup.get(controlName);
    if (isEdit && control?.value) {
      // Check if value is in DD/MM/YYYY format (contains /)
      if (control.value.includes('/')) {
        return true;
      }
    }
    return false;
  }
}

