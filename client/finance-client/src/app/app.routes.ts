import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'transactions',
        children: [
          {
            path: 'incomes',
            loadComponent: () => import('./features/transactions/transaction-list/transaction-list.component').then(m => m.TransactionListComponent)
          },
          {
            path: 'expenses',
            loadComponent: () => import('./features/transactions/transaction-list/transaction-list.component').then(m => m.TransactionListComponent)
          },
          {
            path: '',
            redirectTo: 'expenses',
            pathMatch: 'full'
          }
        ]
      },
      {
        path: 'incomes/new',
        loadComponent: () => import('./features/transactions/income-form/income-form.component').then(m => m.IncomeFormComponent)
      },
      {
        path: 'incomes/edit/:id',
        loadComponent: () => import('./features/transactions/income-form/income-form.component').then(m => m.IncomeFormComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/category-list/category-list.component').then(m => m.CategoryListComponent)
      },
      {
        path: 'categories/new',
        loadComponent: () => import('./features/categories/category-form/category-form.component').then(m => m.CategoryFormComponent)
      },
      {
        path: 'categories/edit/:id',
        loadComponent: () => import('./features/categories/category-form/category-form.component').then(m => m.CategoryFormComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'bank-statements',
        loadComponent: () => import('./features/bank-statements/bank-statements.component').then(m => m.BankStatementsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
