import { Component, Inject, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Transaction } from '../../../core/models/transaction.model';
import { Category } from '../../../core/models/category.model';
import { DateHelperService } from '../../../core/utils/date-helper.service';
import { TransactionHelperService } from '../../../core/utils/transaction-helper.service';

export interface TransactionEditDialogData {
  transaction: Transaction;
  categories: Category[];
}

@Component({
  selector: 'app-transaction-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatCheckboxModule
  ],
  templateUrl: './transaction-edit-dialog.component.html',
  styleUrl: './transaction-edit-dialog.component.scss'
})
export class TransactionEditDialogComponent implements OnInit {
  transactionForm: FormGroup;
  isSubmitting: boolean = false;
  transactionId: number;

  constructor(
    public dialogRef: MatDialogRef<TransactionEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TransactionEditDialogData,
    private fb: FormBuilder,
    private dateHelper: DateHelperService,
    private transactionHelper: TransactionHelperService
  ) {
    this.transactionId = data.transaction.id;
    const today = new Date();
    const todayString = this.dateHelper.formatDateForDisplay(today);
    
    // Initialize form based on transaction type
    if (data.transaction.type === 'Income') {
      this.transactionForm = this.fb.group({
        transactionDate: [todayString, [Validators.required, this.dateHelper.dateValidator()]],
        amount: [null, [Validators.required, Validators.min(0.01)]],
        categoryId: [null, Validators.required],
        source: ['', [Validators.required, Validators.maxLength(100)]],
        currency: ['ILS', Validators.maxLength(10)],
        notes: ['']
      });
    } else {
      // Expense form
      this.transactionForm = this.fb.group({
        transactionDate: [todayString, [Validators.required, this.dateHelper.dateValidator()]],
        billingDate: [todayString, [Validators.required, this.dateHelper.dateValidator()]],
        amount: [null, [Validators.required, Validators.min(0.01)]],
        categoryId: [null, Validators.required],
        merchantName: ['', [Validators.required, Validators.maxLength(100)]],
        source: ['', [Validators.required, Validators.maxLength(100)]],
        referenceNumber: ['', Validators.maxLength(50)],
        cardNumber: ['', Validators.maxLength(4)],
        currency: ['ILS', Validators.maxLength(10)],
        installments: [null],
        branch: ['', Validators.maxLength(100)],
        notes: [''],
        IsHalves: [false]
      });
    }
  }

  ngOnInit(): void {
    this.loadTransactionData();
  }

  loadTransactionData(): void {
    const transaction = this.data.transaction;
    const transactionDate = transaction.transactionDate || transaction.date;
    const billingDate = transaction.billingDate || transactionDate;

    let transactionDateStr = '';
    let billingDateStr = '';

    if (transactionDate) {
      const date = new Date(transactionDate);
      transactionDateStr = this.dateHelper.formatDateForDisplay(date);
    }

    if (billingDate) {
      const date = new Date(billingDate);
      billingDateStr = this.dateHelper.formatDateForDisplay(date);
    }

    if (transaction.type === 'Income') {
      this.transactionForm.patchValue({
        transactionDate: transactionDateStr,
        amount: transaction.amount,
        categoryId: transaction.categoryId ? Number(transaction.categoryId) : null,
        source: transaction.source || '',
        currency: transaction.currency || 'ILS',
        notes: transaction.notes || ''
      }, { emitEvent: false });
    } else {
      this.transactionForm.patchValue({
        transactionDate: transactionDateStr,
        billingDate: billingDateStr,
        amount: transaction.amount,
        categoryId: transaction.categoryId ? Number(transaction.categoryId) : null,
        merchantName: transaction.merchantName || '',
        source: transaction.source || '',
        referenceNumber: transaction.referenceNumber || '',
        cardNumber: transaction.cardNumber || '',
        currency: transaction.currency || 'ILS',
        installments: transaction.installments ? Number(transaction.installments) : null,
        branch: transaction.branch || '',
        notes: transaction.notes || '',
        IsHalves: transaction.IsHalves || false
      }, { emitEvent: false });
    }

    this.transactionForm.markAllAsTouched();
    this.transactionForm.updateValueAndValidity();
    
    // Force update input display after form is patched
    setTimeout(() => {
      const transactionDateControl = this.transactionForm.get('transactionDate');
      if (transactionDateControl && transactionDateStr) {
        transactionDateControl.setValue(transactionDateStr, { emitEvent: false });
      }
      if (this.data.transaction.type === 'Expense') {
        const billingDateControl = this.transactionForm.get('billingDate');
        if (billingDateControl && billingDateStr) {
          billingDateControl.setValue(billingDateStr, { emitEvent: false });
        }
      }
    }, 0);
  }

  onSubmit(): void {
    // Prevent double submission
    if (this.isSubmitting) {
      return;
    }

    if (this.transactionForm.valid) {
      const formValue = this.transactionForm.value;
      
      // Convert date strings from dd/MM/yyyy to Date objects
      const transactionDate = this.dateHelper.parseDateFromDisplay(formValue.transactionDate) || new Date();
      const billingDate = this.data.transaction.type === 'Expense' 
        ? (this.dateHelper.parseDateFromDisplay(formValue.billingDate) || transactionDate)
        : transactionDate;
      
      let transaction: Partial<Transaction>;
      
      if (this.data.transaction.type === 'Income') {
        // Validate required fields before submitting
        const source = String(formValue.source || '').trim();
        const amount = this.transactionHelper.parseAmount(formValue.amount);
        
        if (!source) {
          this.transactionForm.get('source')?.setErrors({ required: true });
          this.transactionForm.get('source')?.markAsTouched();
          return;
        }
        
        if (amount <= 0) {
          this.transactionForm.get('amount')?.setErrors({ min: true });
          this.transactionForm.get('amount')?.markAsTouched();
          return;
        }
        
        transaction = {
          transactionDate: transactionDate.toISOString(),
          billingDate: billingDate.toISOString(),
          amount: amount,
          categoryId: Number(formValue.categoryId),
          type: 'Income',
          merchantName: source || 'Income',
          source: source,
          currency: formValue.currency || 'ILS',
          notes: formValue.notes ? String(formValue.notes).trim() : undefined
        };
      } else {
        // Validate required fields before submitting
        const merchantName = String(formValue.merchantName || '').trim();
        const amount = this.transactionHelper.parseAmount(formValue.amount);
        
        if (!merchantName) {
          this.transactionForm.get('merchantName')?.setErrors({ required: true });
          this.transactionForm.get('merchantName')?.markAsTouched();
          return;
        }
        
        if (amount <= 0) {
          this.transactionForm.get('amount')?.setErrors({ min: true });
          this.transactionForm.get('amount')?.markAsTouched();
          return;
        }
        
        transaction = {
          transactionDate: transactionDate.toISOString(),
          billingDate: billingDate.toISOString(),
          amount: amount,
          categoryId: Number(formValue.categoryId),
          type: 'Expense',
          merchantName: merchantName,
          source: String(formValue.source || '').trim(),
          referenceNumber: formValue.referenceNumber ? String(formValue.referenceNumber).trim() : undefined,
          cardNumber: formValue.cardNumber ? String(formValue.cardNumber).trim() : undefined,
          currency: formValue.currency || 'ILS',
          installments: formValue.installments ? Number(formValue.installments) : undefined,
          branch: formValue.branch ? String(formValue.branch).trim() : undefined,
          notes: formValue.notes ? String(formValue.notes).trim() : undefined,
          IsHalves: formValue.IsHalves || false
        };
      }

      this.isSubmitting = true;
      
      // Return transaction with the original ID preserved
      this.dialogRef.close({
        ...transaction,
        id: this.transactionId // Ensure ID is preserved
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  // Date helper methods
  onDatePickerChange(event: Event, controlName: string): void {
    this.dateHelper.onDatePickerChange(event, controlName, this.transactionForm);
  }
  
  onDateInputClick(event: Event): void {
    this.dateHelper.onDateInputClick(event);
  }
  
  getDateInputValue(dateString: string): string {
    return this.dateHelper.getDateInputValue(dateString);
  }

  getDateInputType(controlName: string): string {
    return this.dateHelper.getDateInputType(controlName, this.transactionForm, true);
  }

  getDateReadOnly(controlName: string): boolean {
    return this.dateHelper.getDateReadOnly(controlName, this.transactionForm, true);
  }

  // Get categories based on transaction type
  getCategories(): Category[] {
    if (this.data.transaction.type === 'Income') {
      return this.data.categories.filter(c => {
        const categoryType = c.type?.toLowerCase();
        return categoryType === 'income' || categoryType === 'all';
      });
    } else {
      return this.data.categories.filter(c => {
        const categoryType = c.type?.toLowerCase();
        return categoryType === 'expense' || !categoryType;
      });
    }
  }

  get isIncome(): boolean {
    return this.data.transaction.type === 'Income';
  }
}

