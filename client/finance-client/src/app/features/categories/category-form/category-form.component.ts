import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/category.model';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-category-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss'
})
export class CategoryFormComponent implements OnInit {
  categoryForm: FormGroup;
  loading = false;
  isEdit = false;
  categoryId?: number;

  constructor(
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(50)]],
      color: [''], // Optional - backend will assign if empty
      icon: [''],
      type: ['Expense', [Validators.required]] // Allow only 'Income' or 'Expense' on server-side
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.categoryId = +id;
      this.loadCategory(+id);
    }
  }

  loadCategory(id: number): void {
    this.categoryService.getCategoryById(id).subscribe({
      next: (category) => {
        this.categoryForm.patchValue({
          name: category.name,
          color: category.color,
          icon: category.icon,
          type: category.type || 'Expense'
        });
      }
    });
  }

  onSubmit(): void {
    if (this.categoryForm.valid) {
      this.loading = true;
      const formValue = this.categoryForm.value;
      
      const category: Partial<Category> = {
        name: formValue.name,
        color: formValue.color,
        icon: formValue.icon,
        type: formValue.type // 'Income' or 'Expense'
      };

      const operation = this.isEdit && this.categoryId
        ? this.categoryService.updateCategory(this.categoryId, category)
        : this.categoryService.createCategory(category);

      operation.subscribe({
        next: () => {
          this.snackBar.open(
            this.isEdit ? 'קטגוריה עודכנה בהצלחה' : 'קטגוריה נוצרה בהצלחה',
            'סגור',
            { duration: 3000 }
          );
          // Navigate to dashboard to see updated data
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          const message = error.error?.message || 'שגיאה בשמירת הקטגוריה';
          this.snackBar.open(message, 'סגור', { duration: 3000 });
          this.loading = false;
        }
      });
    }
  }
}

