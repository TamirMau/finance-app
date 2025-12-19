import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BankStatement, BankStatementUploadResponse, BankStatementRow } from '../models/bank-statement.model';
import { LoggerService } from './logger.service';

@Injectable({
  providedIn: 'root'
})
export class BankStatementService {
  private apiUrl = `${environment.apiBaseUrl}/api/bankstatements`;

  constructor(
    private http: HttpClient,
    private logger: LoggerService
  ) {}

  getBankStatement(): Observable<BankStatement> {
    this.logger.log('[BANK STATEMENT] Fetching bank statement');
    
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        try {
          const normalized = this.normalizeStatement(response);
          this.logger.log('[BANK STATEMENT] Bank statement fetched successfully', { 
            accountNumber: normalized.accountNumber, 
            rowsCount: normalized.rows.length 
          });
          return normalized;
        } catch (error) {
          this.logger.error('[BANK STATEMENT] Error normalizing bank statement', error);
          return {
            accountNumber: '',
            statementDate: new Date(),
            balance: undefined,
            rows: []
          };
        }
      })
    );
  }

  uploadBankStatement(file: File): Observable<BankStatementUploadResponse> {
    this.logger.log('[BANK STATEMENT] Uploading bank statement file', { 
      fileName: file.name, 
      fileSize: file.size 
    });
    
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<any>(`${this.apiUrl}/upload`, formData).pipe(
      map(response => {
        const normalized = this.normalizeResponse(response);
        if (normalized.success) {
          this.logger.log('[BANK STATEMENT] File upload successful', { 
            fileName: file.name, 
            totalRows: normalized.totalRows 
          });
        } else {
          this.logger.error('[BANK STATEMENT] File upload failed', { 
            fileName: file.name, 
            error: normalized.message 
          });
        }
        return normalized;
      })
    );
  }

  private normalizeStatement(statement: any): BankStatement {
    if (!statement) {
      return {
        accountNumber: '',
        statementDate: new Date(),
        balance: undefined,
        rows: []
      };
    }

    try {
      // Ensure we have a valid statement object
      const normalized: BankStatement = {
        accountNumber: statement.accountNumber || '',
        statementDate: statement.statementDate ? new Date(statement.statementDate) : new Date(),
        balance: statement.balance !== undefined && statement.balance !== null ? statement.balance : undefined,
        rows: []
      };

      if (statement.rows && Array.isArray(statement.rows)) {
        normalized.rows = statement.rows.map((row: any) => {
          try {
            // Parse dates as UTC to avoid timezone issues
            // Server sends dates like "2025-12-01T00:00:00" which should be treated as UTC
            let parsedDate: Date | null = null;
            let parsedValueDate: Date = new Date();
            
            if (row.date) {
              const dateStr = String(row.date);
              // If it ends with 'Z', it's already UTC
              if (dateStr.endsWith('Z')) {
                parsedDate = new Date(dateStr);
              } else {
                // Parse as UTC: "2025-12-01T00:00:00" -> UTC date
                const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                if (match) {
                  const year = parseInt(match[1], 10);
                  const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
                  const day = parseInt(match[3], 10);
                  parsedDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                } else {
                  parsedDate = new Date(dateStr);
                }
              }
            }
            
            if (row.valueDate) {
              const valueDateStr = String(row.valueDate);
              if (valueDateStr.endsWith('Z')) {
                parsedValueDate = new Date(valueDateStr);
              } else {
                const match = valueDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
                if (match) {
                  const year = parseInt(match[1], 10);
                  const month = parseInt(match[2], 10) - 1;
                  const day = parseInt(match[3], 10);
                  parsedValueDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                } else {
                  parsedValueDate = new Date(valueDateStr);
                }
              }
            }
            
            return {
              ...row,
              valueDate: parsedValueDate,
              date: parsedDate,
              forBenefitOf: row.forBenefitOf || null,
              for: row.for || null
            };
          } catch (e) {
            this.logger.error('Error normalizing row:', e, row);
            return {
              balance: row.balance,
              valueDate: new Date(),
              debit: row.debit,
              credit: row.credit,
              reference: row.reference,
              description: row.description,
              actionType: row.actionType,
              date: null,
              forBenefitOf: row.forBenefitOf || null,
              for: row.for || null
            };
          }
        });
      } else {
        normalized.rows = [];
      }

      return normalized;
    } catch (e) {
      this.logger.error('Error normalizing statement:', e);
      return {
        accountNumber: '',
        statementDate: new Date(),
        balance: undefined,
        rows: []
      };
    }
  }

  private normalizeResponse(response: any): BankStatementUploadResponse {
    if (!response) {
      this.logger.error('Response is null or undefined');
      return {
        success: false,
        message: 'תגובה ריקה מהשרת',
        statement: undefined,
        totalRows: 0
      };
    }

    if (response.statement) {
      // Convert date strings to Date objects
      try {
        response.statement.statementDate = new Date(response.statement.statementDate);
        
        if (response.statement.rows && Array.isArray(response.statement.rows)) {
          response.statement.rows = response.statement.rows.map((row: any) => {
            try {
              return {
                ...row,
                valueDate: row.valueDate ? new Date(row.valueDate) : new Date(),
                date: row.date ? new Date(row.date) : new Date()
              };
            } catch (e) {
              this.logger.error('Error parsing row dates:', e, row);
              return {
                ...row,
                valueDate: new Date(),
                date: new Date()
              };
            }
          });
        }
      } catch (e) {
        this.logger.error('Error normalizing dates:', e);
      }
    }
    
    return response as BankStatementUploadResponse;
  }

  getCreditTransactions(): Observable<BankStatement> {
    return this.http.get<BankStatement>(`${this.apiUrl}/credits`).pipe(
      map(response => {
        return this.normalizeStatement(response);
      })
    );
  }
}

