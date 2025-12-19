import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../core/models/category.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { CategoryEditDialogComponent, CategoryEditDialogData } from '../../../shared/components/category-edit-dialog/category-edit-dialog.component';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule
  ],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss'
})
export class CategoryListComponent implements OnInit {
  displayedColumns: string[] = ['name', 'color', 'icon', 'type', 'actions'];
  categories: Category[] = [];
  loading = false;

  constructor(
    private categoryService: CategoryService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteCategory(id: number): void {
    this.confirmDialog.confirmDelete('האם אתה בטוח שברצונך למחוק את הקטגוריה?').subscribe(confirmed => {
      if (confirmed) {
        this.categoryService.deleteCategory(id).subscribe({
          next: () => {
            this.snackBar.open('קטגוריה נמחקה בהצלחה', 'סגור', { duration: 3000 });
            this.loadCategories();
          },
          error: (error) => {
            const message = error.error?.message || 'שגיאה במחיקת הקטגוריה';
            this.snackBar.open(message, 'סגור', { duration: 3000 });
          }
        });
      }
    });
  }

  editCategory(category: Category): void {
    const dialogRef = this.dialog.open(CategoryEditDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      direction: 'rtl',
      autoFocus: false,
      data: {
        category: category
      } as CategoryEditDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Ensure ID is preserved
        const categoryId = category.id;
        if (!categoryId) {
          this.snackBar.open('שגיאה: לא נמצא מזהה קטגוריה', 'סגור', { duration: 3000 });
          return;
        }

        // Update category
        this.updateCategoryFromDialog(categoryId, result);
      }
    });
  }

  private updateCategoryFromDialog(categoryId: number, categoryData: Partial<Category>): void {
    this.loading = true;

    // Ensure ID is included in the payload
    const payload = {
      ...categoryData,
      id: categoryId // Explicitly preserve ID
    };

    this.categoryService.updateCategory(categoryId, payload).subscribe({
      next: () => {
        this.snackBar.open('קטגוריה עודכנה בהצלחה', 'סגור', { duration: 3000 });
        this.loadCategories();
      },
      error: (error) => {
        const message = error.error?.message || 'שגיאה בשמירת הקטגוריה';
        this.snackBar.open(message, 'סגור', { duration: 3000 });
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  updateCategoryColors(): void {
    this.loading = true;
    this.categoryService.updateCategoriesWithColors().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.loading = false;
        this.cdr.detectChanges();
        this.snackBar.open('צבעי הקטגוריות עודכנו בהצלחה', 'סגור', { duration: 3000 });
      },
      error: (error) => {
        this.loading = false;
        this.cdr.detectChanges();
        const message = error.error?.message || 'שגיאה בעדכון צבעי הקטגוריות';
        this.snackBar.open(message, 'סגור', { duration: 3000 });
      }
    });
  }

  // Returns localized display text for category type
  displayType(category: Category): string {
    if (!category.type) return '';
    if (category.type === 'Income') return 'הכנסה';
    if (category.type === 'Expense') return 'הוצאה';
    return category.type;
  }
}

