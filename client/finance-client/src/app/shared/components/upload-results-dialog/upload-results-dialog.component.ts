import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface UploadResultsData {
  success: boolean;
  message?: string;
  totalCreated?: number;
  totalParsed?: number;
}

@Component({
  selector: 'app-upload-results-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './upload-results-dialog.component.html',
  styleUrl: './upload-results-dialog.component.scss',
  encapsulation: ViewEncapsulation.None
})
export class UploadResultsDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<UploadResultsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UploadResultsData
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}

