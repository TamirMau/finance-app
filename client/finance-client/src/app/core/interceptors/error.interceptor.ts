import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../services/logger.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);
  const authService = inject(AuthService);
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Extract error message from API response
      let errorMessage = 'אירעה שגיאה';
      
      if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Log error details
      logger.error('[HTTP ERROR]', error, {
        url: req.url,
        method: req.method,
        status: error.status,
        statusText: error.statusText,
        error: errorMessage,
        errorDetails: error.error
      });

      // Handle 401 Unauthorized
      if (error.status === 401) {
        const currentUrl = router.url;
        const isAuthPage = currentUrl === '/login' || currentUrl === '/register';
        
        logger.warn('[HTTP ERROR] Unauthorized (401)', { 
          url: req.url, 
          currentPage: currentUrl, 
          isAuthPage 
        });
        
        // If we're on login/register page, don't redirect - let the component handle the error
        if (!isAuthPage) {
          logger.log('[HTTP ERROR] Session expired, logging out and redirecting to login');
          authService.logout();
          router.navigate(['/login']);
          snackBar.open('הסשן שלך פג. אנא התחבר שוב.', 'סגור', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'top'
          });
        }
        // For auth pages, the error will be handled by the component
        // Don't show snackbar here to avoid duplicate messages
        return throwError(() => error);
      }

      // Handle 500 Internal Server Error
      if (error.status === 500) {
        logger.error('[HTTP ERROR] Server error (500)', error, { 
          url: req.url, 
          error: errorMessage,
          errorDetails: error.error 
        });
      }

      // Handle other errors - show snackbar
      snackBar.open(errorMessage, 'סגור', {
        duration: 5000,
        horizontalPosition: 'end',
        verticalPosition: 'top'
      });

      return throwError(() => error);
    })
  );
};

