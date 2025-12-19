import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Category } from '../../../core/models/category.model';

export interface CategoryEditDialogData {
  category: Category;
}

@Component({
  selector: 'app-category-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './category-edit-dialog.component.html',
  styleUrl: './category-edit-dialog.component.scss'
})
export class CategoryEditDialogComponent implements OnInit {
  categoryForm: FormGroup;
  isSubmitting: boolean = false;
  categoryId: number;

  constructor(
    public dialogRef: MatDialogRef<CategoryEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CategoryEditDialogData,
    private fb: FormBuilder
  ) {
    this.categoryId = data.category.id;
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(50)]],
      color: [''], // Optional - backend will assign if empty
      icon: ['']
    });
  }

  ngOnInit(): void {
    this.loadCategoryData();
  }

  loadCategoryData(): void {
    const category = this.data.category;
    this.categoryForm.patchValue({
      name: category.name,
      color: category.color,
      icon: category.icon
    }, { emitEvent: false });
    
    this.categoryForm.markAllAsTouched();
    this.categoryForm.updateValueAndValidity();
  }

  onSubmit(): void {
    // Prevent double submission
    if (this.isSubmitting) {
      return;
    }

    if (this.categoryForm.valid) {
      const formValue = this.categoryForm.value;
      
      const category: Partial<Category> = {
        name: formValue.name,
        color: formValue.color,
        icon: formValue.icon
      };

      this.isSubmitting = true;
      
      // Return category with the original ID preserved
      this.dialogRef.close({
        ...category,
        id: this.categoryId // Ensure ID is preserved
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

