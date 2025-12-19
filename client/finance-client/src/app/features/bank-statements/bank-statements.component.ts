import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { BankStatementService } from '../../core/services/bank-statement.service';
import { BankStatement, BankStatementRow } from '../../core/models/bank-statement.model';
import { UploadResultsDialogComponent, UploadResultsData } from '../../shared/components/upload-results-dialog/upload-results-dialog.component';
import { LoggerService } from '../../core/services/logger.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-bank-statements',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatInputModule
  ],
  templateUrl: './bank-statements.component.html',
  styleUrl: './bank-statements.component.scss'
})
export class BankStatementsComponent implements OnInit {
  statement: BankStatement | null = null;
  private _loading = false;
  error: string | null = null;

  get loading(): boolean {
    return this._loading;
  }

  set loading(value: boolean) {
    if (this._loading !== value) {
      this._loading = value;
      this.cdr.detectChanges();
    }
  }

  displayedColumns: string[] = [
    'date',
    'actionType',
    'description',
    'reference',
    'credit',
    'debit',
    'valueDate',
    'balance',
    'forBenefitOf',
    'for'
  ];

  constructor(
    private bankStatementService: BankStatementService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.loadBankStatement();
  }

  loadBankStatement(): void {
    this.loading = true;
    this.error = null;

    this.bankStatementService.getBankStatement().pipe(
      catchError((error) => {
        this.logger.error('Error loading bank statement:', error);
        this.error = 'שגיאה בטעינת הנתונים';
        this.statement = null;
        this.loading = false;
        const fallback = {
          accountNumber: '',
          statementDate: new Date(),
          balance: undefined,
          rows: []
        } as BankStatement;
        return of(fallback);
      })
    ).subscribe({
      next: (statement) => {
        // Check if statement has data (either accountNumber or rows)
        if (statement && (statement.accountNumber || (statement.rows && statement.rows.length > 0))) {
          this.statement = statement;
        } else {
          this.statement = null;
        }
        this.loading = false;
      },
      error: (error) => {
        this.logger.error('Error loading bank statement:', error);
        this.statement = null;
        this.error = 'שגיאה בטעינת הנתונים';
        this.loading = false;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      this.uploadFile(file);
    }
  }

  uploadFile(file: File): void {
    this.loading = true;
    this.error = null;
    this.statement = null;

    this.bankStatementService.uploadBankStatement(file).pipe(
      catchError((error) => {
        this.logger.error('Error uploading file:', error);
        const errorMessage = error?.error?.message || error?.message || 'הטעינה נכשלה – אנא בדוק את הקובץ ונסה שוב';
        this.error = errorMessage;
        this.showErrorDialog(errorMessage);
        this.loading = false;
        const fallback = {
          success: false,
          message: errorMessage,
          statement: undefined,
          totalRows: 0
        } as any;
        return of(fallback);
      })
    ).subscribe({
      next: (response) => {
        if (response && response.success && response.statement) {
          this.statement = response.statement;
          this.loading = false;
          
          // Reload to get the saved data (without showing loader again)
          this.bankStatementService.getBankStatement().pipe(
            catchError((error) => {
              this.logger.error('Error loading bank statement after upload:', error);
              return of({
                accountNumber: '',
                statementDate: new Date(),
                balance: undefined,
                rows: []
              } as BankStatement);
            })
          ).subscribe({
            next: (statement) => {
              if (statement && (statement.accountNumber || (statement.rows && statement.rows.length > 0))) {
                this.statement = statement;
              } else {
                this.statement = null;
              }
            }
          });
          
          // Show success dialog
          this.dialog.open(UploadResultsDialogComponent, {
            width: '500px',
            maxWidth: '90vw',
            direction: 'rtl',
            autoFocus: false,
            data: {
              success: true,
              message: `הקובץ נטען בהצלחה. נמצאו ${response.totalRows || 0} שורות.`,
              totalParsed: response.totalRows,
              totalCreated: response.totalRows
            } as UploadResultsData
          });
        } else {
          this.logger.error('Invalid upload response:', response);
          this.error = response?.message || 'שגיאה בטעינת הקובץ';
          this.showErrorDialog(response?.message || 'שגיאה בטעינת הקובץ');
          this.loading = false;
        }
      },
      error: (error) => {
        this.logger.error('Error uploading file:', error);
        this.error = 'שגיאה בטעינת הקובץ';
        this.loading = false;
      }
    });
  }

  private showErrorDialog(message: string): void {
    this.dialog.open(UploadResultsDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      direction: 'rtl',
      autoFocus: false,
      data: {
        success: false,
        message: message
      } as UploadResultsData
    });
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatCurrency(amount: number | null | undefined): string {
    if (amount == null) return '';
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  getRows(): BankStatementRow[] {
    // Return all rows without filtering
    return this.statement?.rows || [];
  }
}

