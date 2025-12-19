import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  constructor(private dialog: MatDialog) {}

  confirm(data: ConfirmDialogData): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: 'auto',
      maxWidth: '500px',
      disableClose: true,
      data: data,
      panelClass: 'confirm-dialog-panel',
      autoFocus: false,
      restoreFocus: false
    });

    return dialogRef.afterClosed();
  }

  confirmDelete(message: string, itemName?: string): Observable<boolean> {
    return this.confirm({
      title: 'מחיקה',
      message: message,
      confirmText: 'מחק',
      cancelText: 'ביטול',
      confirmColor: 'warn',
      icon: 'delete_outline'
    });
  }

  confirmReset(message: string): Observable<boolean> {
    return this.confirm({
      title: 'איפוס הגדרות',
      message: message,
      confirmText: 'איפוס',
      cancelText: 'ביטול',
      confirmColor: 'warn',
      icon: 'restart_alt'
    });
  }
}

