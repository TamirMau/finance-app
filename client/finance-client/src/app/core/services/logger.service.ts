import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Centralized logging service for the application
 * Replaces console.log/warn/error with a structured logging approach
 * Can be extended in the future to send logs to a backend service
 * 
 * Logging levels:
 * - error(): Always logged (production + development) - Critical errors - IMPORTANT FOR PRODUCTION DEBUGGING
 * - warn(): Always logged (production + development) - Warnings - IMPORTANT FOR PRODUCTION DEBUGGING
 * - log(): Only in development - General information (not shown in production to reduce noise)
 * - debug(): Only in development - Detailed debugging information
 */
@Injectable({
  providedIn: 'root'
})
export class LoggerService {
  
  /**
   * Log informational messages
   * Only logged in development mode - use for general information
   * For production-critical information, use warn() or error()
   */
  log(message: string, ...args: any[]): void {
    if (!environment.production) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  /**
   * Log warning messages
   * Always logged (including production) - use for warnings
   */
  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  /**
   * Log error messages
   * Always logged (including production) - use for errors and exceptions
   * This is critical for debugging production issues
   */
  error(message: string, error?: any, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, error, ...args);
  }

  /**
   * Log debug messages
   * Only logged in development mode - use for detailed debugging
   * Will NOT appear in production builds
   */
  debug(message: string, ...args: any[]): void {
    if (!environment.production) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * Check if we're in development mode
   * Uses environment.production flag for accurate detection
   */
  private isDevelopment(): boolean {
    return !environment.production;
  }
}

