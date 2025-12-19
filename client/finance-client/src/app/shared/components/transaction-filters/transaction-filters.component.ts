import { Component, Input, Output, EventEmitter, signal, computed, WritableSignal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Category } from '../../../core/models/category.model';
import { Transaction } from '../../../core/models/transaction.model';

/**
 * Component for filtering and searching transactions
 * Extracted from TransactionListComponent to improve maintainability
 */
@Component({
  selector: 'app-transaction-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule
  ],
  templateUrl: './transaction-filters.component.html',
  styleUrl: './transaction-filters.component.scss'
})
export class TransactionFiltersComponent {
  @Input() searchTerm: WritableSignal<string> = signal('');
  @Input() selectedCategoryFilter: WritableSignal<number | null> = signal(null);
  @Input() categories: Signal<Category[]> = signal([]);
  @Input() transactions: Signal<Transaction[]> = signal([]);
  @Input() showIncomeOnly: boolean = false; // If true, show only income categories
  
  @Output() searchChange = new EventEmitter<string>();
  @Output() categoryChange = new EventEmitter<number | null>();
  @Output() clearFilters = new EventEmitter<void>();

  // Computed property for filtered categories - only show categories that exist in transactions
  filteredCategories = computed(() => {
    const allCategories = this.categories();
    const transactions = this.transactions();
    
    // If no transactions, return empty array
    if (!transactions || transactions.length === 0) {
      return [];
    }
    
    // Get unique category IDs from transactions
    const categoryIdsInTransactions = new Set<number>();
    transactions.forEach((t: Transaction) => {
      if (t.categoryId) {
        categoryIdsInTransactions.add(t.categoryId);
      }
    });
    
    // Filter categories to only those that exist in transactions
    let filtered = allCategories.filter((c: Category) => {
      // First check if category exists in transactions
      if (!categoryIdsInTransactions.has(c.id)) {
        return false;
      }
      
      // Then apply type filter if needed
      if (this.showIncomeOnly) {
        const categoryType = c.type?.toLowerCase();
        return categoryType === 'income' || categoryType === 'all';
      }
      return true;
    });
    
    return filtered;
  });
  
  // Check if there are any categories available
  hasCategories = computed(() => this.filteredCategories().length > 0);

  onSearchInput(value: string): void {
    this.searchChange.emit(value);
  }

  onCategorySelect(value: string | number | null): void {
    const categoryId = value === '' || value === null ? null : +value;
    this.categoryChange.emit(categoryId);
  }

  onClearFilters(): void {
    this.clearFilters.emit();
  }
}

