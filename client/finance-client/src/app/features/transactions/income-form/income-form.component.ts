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
  selector: 'app-income-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule
  ],
  templateUrl: './income-form.component.html',
  styleUrl: './income-form.component.scss'
})
export class IncomeFormComponent implements OnInit, OnChanges {
  @Input() transaction: Transaction | null = null;
  @Input() categories: Category[] = [];
  @Input() loading: boolean = false;
  @Output() submit = new EventEmitter<Partial<Transaction>>();
  @Output() cancel = new EventEmitter<void>();

  incomeForm: FormGroup;
  isEdit: boolean = false;
  private isSubmitting: boolean = false;

  constructor(
    private fb: FormBuilder,
    private dateHelper: DateHelperService,
    private transactionHelper: TransactionHelperService
  ) {
    const today = new Date();
    const todayString = this.dateHelper.formatDateForDisplay(today);
    
    this.incomeForm = this.fb.group({
      transactionDate: [todayString, [Validators.required, this.dateHelper.dateValidator()]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      categoryId: [null, Validators.required],
      source: ['', [Validators.required, Validators.maxLength(100)]],
      currency: ['ILS', Validators.maxLength(10)],
      notes: ['']
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

    let transactionDateStr = '';

    if (transactionDate) {
      const date = new Date(transactionDate);
      transactionDateStr = this.dateHelper.formatDateForDisplay(date);
    }

    this.incomeForm.patchValue({
      transactionDate: transactionDateStr,
      amount: this.transaction.amount,
      categoryId: this.transaction.categoryId ? Number(this.transaction.categoryId) : null,
      source: this.transaction.source || '',
      currency: this.transaction.currency || 'ILS',
      notes: this.transaction.notes || ''
    }, { emitEvent: false });

    this.incomeForm.markAllAsTouched();
    this.incomeForm.updateValueAndValidity();
    
    // Force update input display after form is patched
    setTimeout(() => {
      const transactionDateControl = this.incomeForm.get('transactionDate');
      if (transactionDateControl && transactionDateStr) {
        transactionDateControl.setValue(transactionDateStr, { emitEvent: false });
      }
    }, 0);
  }

  onSubmit(): void {
    // Prevent double submission
    if (this.isSubmitting || this.loading) {
      return;
    }

    if (this.incomeForm.valid) {
      const formValue = this.incomeForm.value;
      
      // Convert date strings from dd/MM/yyyy to Date objects
      const transactionDate = this.dateHelper.parseDateFromDisplay(formValue.transactionDate) || new Date();
      const billingDate = transactionDate; // Use transaction date as billing date for income
      
      // Validate required fields before submitting
      const source = String(formValue.source || '').trim();
      const amount = this.transactionHelper.parseAmount(formValue.amount);
      
      if (!source) {
        this.incomeForm.get('source')?.setErrors({ required: true });
        this.incomeForm.get('source')?.markAsTouched();
        return;
      }
      
      if (amount <= 0) {
        this.incomeForm.get('amount')?.setErrors({ min: true });
        this.incomeForm.get('amount')?.markAsTouched();
        return;
      }
      
      this.isSubmitting = true;
      
      const transaction: Partial<Transaction> = {
        transactionDate: transactionDate.toISOString(),
        billingDate: billingDate.toISOString(),
        amount: amount,
        categoryId: Number(formValue.categoryId),
        type: 'Income',
        merchantName: source || 'Income', // Use source as merchantName for income
        source: source,
        currency: formValue.currency || 'ILS',
        notes: formValue.notes ? String(formValue.notes).trim() : undefined
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
    
    this.incomeForm.reset({
      transactionDate: todayString,
      amount: null,
      categoryId: null,
      source: '',
      currency: 'ILS',
      notes: ''
    });
    
    this.isEdit = false;
  }

  // Date helper methods - delegate to DateHelperService
  // These wrapper methods are kept for template compatibility
  onDatePickerChange(event: Event, controlName: string): void {
    this.dateHelper.onDatePickerChange(event, controlName, this.incomeForm);
  }
  
  onDateInputClick(event: Event): void {
    this.dateHelper.onDateInputClick(event);
  }
  
  getDateInputValue(dateString: string): string {
    return this.dateHelper.getDateInputValue(dateString);
  }

  getDateInputType(controlName: string): string {
    return this.dateHelper.getDateInputType(controlName, this.incomeForm, this.isEdit);
  }

  getDateReadOnly(controlName: string): boolean {
    return this.dateHelper.getDateReadOnly(controlName, this.incomeForm, this.isEdit);
  }

  // Get only Income categories
  getIncomeCategories(): Category[] {
    return this.categories.filter(c => {
      const categoryType = c.type?.toLowerCase();
      return categoryType === 'income';
    });
  }
}
