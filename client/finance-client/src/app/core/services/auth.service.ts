import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, User } from '../models/user.model';
import { TransactionService } from './transaction.service';
import { UserSettingsService } from './user-settings.service';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiBaseUrl}/api/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private transactionService: TransactionService,
    private userSettingsService: UserSettingsService,
    private logger: LoggerService
  ) {}

  register(username: string, email: string, password: string): Observable<AuthResponse> {
    this.logger.log('[AUTH] Registration attempt started', { username, email });
    
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, {
      username,
      email,
      password
    }).pipe(
      tap({
        next: (response) => {
          this.logger.log('[AUTH] Registration successful', { userId: response.user.id, username: response.user.username });
          this.handleAuthResponse(response);
        },
        error: (error) => {
          this.logger.error('[AUTH] Registration failed', error, { 
            username, 
            email, 
            error: error?.error?.message || error?.message || 'Unknown error',
            status: error?.status 
          });
        }
      })
    );
  }

  login(username: string, password: string): Observable<AuthResponse> {
    this.logger.log('[AUTH] Login attempt started', { username });
    
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, {
      username,
      password
    }).pipe(
      tap({
        next: (response) => {
          this.logger.log('[AUTH] Login successful', { userId: response.user.id, username: response.user.username });
          this.handleAuthResponse(response);
        },
        error: (error) => {
          this.logger.error('[AUTH] Login failed', error, { 
            username, 
            error: error?.error?.message || error?.message || 'Invalid credentials',
            status: error?.status 
          });
        }
      })
    );
  }

  logout(): void {
    const currentUser = this.currentUserSubject.value;
    this.logger.log('[AUTH] Logout initiated', { userId: currentUser?.id, username: currentUser?.username });
    
    // Clear all cached data before removing token
    this.transactionService.clearCache();
    this.userSettingsService.clearCache();
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    
    this.logger.log('[AUTH] Logout completed');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  private handleAuthResponse(response: AuthResponse): void {
    // Clear old user's cached data before setting new user data
    // This prevents showing previous user's data when switching users
    this.transactionService.clearCache();
    this.userSettingsService.clearCache();
    
    localStorage.setItem('token', response.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    this.currentUserSubject.next(response.user);
    
    // UserSettingsService will load settings automatically when needed
    // Load settings for the new user
    this.userSettingsService.loadSettings();
  }

  private getUserFromStorage(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

