import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Category } from '../../../core/models/category.model';
import { Transaction } from '../../../core/models/transaction.model';
import { DateHelperService } from '../../../core/utils/date-helper.service';
import { TransactionHelperService } from '../../../core/utils/transaction-helper.service';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule
  ],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss'
})
export class ExpenseFormComponent implements OnInit, OnChanges {
  @Input() transaction: Transaction | null = null;
  @Input() categories: Category[] = [];
  @Input() loading: boolean = false;
  @Output() submit = new EventEmitter<Partial<Transaction>>();
  @Output() cancel = new EventEmitter<void>();

  expenseForm: FormGroup;
  isEdit: boolean = false;
  private isSubmitting: boolean = false;

  constructor(
    private fb: FormBuilder,
    private dateHelper: DateHelperService,
    private transactionHelper: TransactionHelperService
  ) {
    const today = new Date();
    const todayString = this.dateHelper.formatDateForDisplay(today);
    
    this.expenseForm = this.fb.group({
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

  ngOnInit(): void {
    if (this.transaction) {
      this.loadTransactionData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['transaction'] && this.transaction) {
      this.loadTransactionData();
    }
    // Reset submitting flag when loading state changes
    if (changes['loading'] && !changes['loading'].currentValue) {
      this.isSubmitting = false;
    }
  }

  loadTransactionData(): void {
    if (!this.transaction) return;

    this.isEdit = true;
    const transactionDate = this.transaction.transactionDate || this.transaction.date;
    const billingDate = this.transaction.billingDate || transactionDate;

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

    this.expenseForm.patchValue({
      transactionDate: transactionDateStr,
      billingDate: billingDateStr,
      amount: this.transaction.amount,
      categoryId: this.transaction.categoryId ? Number(this.transaction.categoryId) : null,
      merchantName: this.transaction.merchantName || '',
      source: this.transaction.source || '',
      referenceNumber: this.transaction.referenceNumber || '',
      cardNumber: this.transaction.cardNumber || '',
      currency: this.transaction.currency || 'ILS',
      installments: this.transaction.installments ? Number(this.transaction.installments) : null,
      branch: this.transaction.branch || '',
      notes: this.transaction.notes || '',
      IsHalves: this.transaction.IsHalves || false
    }, { emitEvent: false });

    this.expenseForm.markAllAsTouched();
    this.expenseForm.updateValueAndValidity();
    
    // Force update input display after form is patched
    setTimeout(() => {
      const transactionDateControl = this.expenseForm.get('transactionDate');
      const billingDateControl = this.expenseForm.get('billingDate');
      if (transactionDateControl && transactionDateStr) {
        transactionDateControl.setValue(transactionDateStr, { emitEvent: false });
      }
      if (billingDateControl && billingDateStr) {
        billingDateControl.setValue(billingDateStr, { emitEvent: false });
      }
    }, 0);
  }

  onSubmit(): void {
    // Prevent double submission
    if (this.isSubmitting || this.loading) {
      return;
    }

    if (this.expenseForm.valid) {
      const formValue = this.expenseForm.value;
      
      // Convert date strings from dd/MM/yyyy to Date objects
      const transactionDate = this.dateHelper.parseDateFromDisplay(formValue.transactionDate) || new Date();
      const billingDate = this.dateHelper.parseDateFromDisplay(formValue.billingDate) || transactionDate;
      
      // Validate required fields before submitting
      const merchantName = String(formValue.merchantName || '').trim();
      const amount = this.transactionHelper.parseAmount(formValue.amount);
      
      if (!merchantName) {
        this.expenseForm.get('merchantName')?.setErrors({ required: true });
        this.expenseForm.get('merchantName')?.markAsTouched();
        return;
      }
      
      if (amount <= 0) {
        this.expenseForm.get('amount')?.setErrors({ min: true });
        this.expenseForm.get('amount')?.markAsTouched();
        return;
      }
      
      this.isSubmitting = true;
      
      const transaction: Partial<Transaction> = {
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

      this.submit.emit(transaction);
      
      // Reset submitting flag after a short delay to allow the parent to handle the submission
      setTimeout(() => {
        this.isSubmitting = false;
      }, 1000);
    }
  }

  onCancel(): void {
    this.isSubmitting = false;
    this.cancel.emit();
    this.resetForm();
  }

  resetForm(): void {
    this.isSubmitting = false;
    const today = new Date();
    const todayString = this.dateHelper.formatDateForDisplay(today);
    
    this.expenseForm.reset({
      transactionDate: todayString,
      billingDate: todayString,
      amount: null,
      categoryId: null,
      merchantName: '',
      source: '',
      referenceNumber: '',
      cardNumber: '',
      currency: 'ILS',
      installments: null,
      branch: '',
      notes: '',
      IsHalves: false
    });
    
    this.isEdit = false;
  }

  // Date helper methods - delegate to DateHelperService
  // These wrapper methods are kept for template compatibility
  onDatePickerChange(event: Event, controlName: string): void {
    this.dateHelper.onDatePickerChange(event, controlName, this.expenseForm);
  }
  
  onDateInputClick(event: Event): void {
    this.dateHelper.onDateInputClick(event);
  }
  
  getDateInputValue(dateString: string): string {
    return this.dateHelper.getDateInputValue(dateString);
  }

  getDateInputType(controlName: string): string {
    return this.dateHelper.getDateInputType(controlName, this.expenseForm, this.isEdit);
  }

  getDateReadOnly(controlName: string): boolean {
    return this.dateHelper.getDateReadOnly(controlName, this.expenseForm, this.isEdit);
  }

  // Get only Expense categories
  getExpenseCategories(): Category[] {
    return this.categories.filter(c => {
      const categoryType = c.type?.toLowerCase();
      return categoryType === 'expense' || !categoryType; // Default to Expense if type is missing
    });
  }
}

