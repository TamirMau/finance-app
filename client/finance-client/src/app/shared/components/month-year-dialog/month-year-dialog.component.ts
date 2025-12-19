import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

export interface MonthYearDialogData {
  year?: number;
  month?: number;
}

export interface MonthYearDialogResult {
  year: number;
  month: number;
}

@Component({
  selector: 'app-month-year-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './month-year-dialog.component.html',
  styleUrl: './month-year-dialog.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class MonthYearDialogComponent {
  selectedMonthYear: string;

  monthYearOptions: { value: string; year: number; month: number; label: string }[] = [];

  constructor(
    public dialogRef: MatDialogRef<MonthYearDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MonthYearDialogData
  ) {
    // Generate month-year combinations (current month and 2 years back)
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    const months = [
      { value: 1, label: 'ינואר' },
      { value: 2, label: 'פברואר' },
      { value: 3, label: 'מרץ' },
      { value: 4, label: 'אפריל' },
      { value: 5, label: 'מאי' },
      { value: 6, label: 'יוני' },
      { value: 7, label: 'יולי' },
      { value: 8, label: 'אוגוסט' },
      { value: 9, label: 'ספטמבר' },
      { value: 10, label: 'אוקטובר' },
      { value: 11, label: 'נובמבר' },
      { value: 12, label: 'דצמבר' }
    ];

    // Generate options for last 3 years, all months
    for (let yearOffset = 0; yearOffset < 3; yearOffset++) {
      const year = currentYear - yearOffset;
      for (const month of months) {
        const value = `${year}-${month.value}`;
        this.monthYearOptions.push({
          value: value,
          year: year,
          month: month.value,
          label: `${month.label} ${year}`
        });
      }
    }

    // Sort by year descending, then by month descending (newest first)
    this.monthYearOptions.sort((a, b) => {
      if (a.year !== b.year) {
        return b.year - a.year;
      }
      return b.month - a.month;
    });

    // Set default value
    const defaultYear = data?.year || currentYear;
    const defaultMonth = data?.month || currentMonth;
    this.selectedMonthYear = `${defaultYear}-${defaultMonth}`;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onConfirm(): void {
    if (this.selectedMonthYear) {
      const selected = this.monthYearOptions.find(opt => opt.value === this.selectedMonthYear);
      if (selected) {
        this.dialogRef.close({
          year: selected.year,
          month: selected.month
        } as MonthYearDialogResult);
      }
    }
  }
}

