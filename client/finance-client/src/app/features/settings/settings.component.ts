import { Component, OnInit, OnDestroy, computed, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormsModule, ReactiveFormsModule, FormGroup, FormBuilder, Validators } from '@angular/forms';
import { UserSettingsService, DateRangeType } from '../../core/services/user-settings.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { LoggerService } from '../../core/services/logger.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatRadioModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit, OnDestroy {
  // Use computed signals directly instead of local properties
  dateRangeType = computed(() => this.settingsService.dateRangeType());
  dateRangeString = computed(() => this.settingsService.getDateRangeString());
  showHalves = computed(() => this.settingsService.showHalves());
  
  // User info
  currentUser = signal<User | null>(null);
  
  // Settings form
  settingsForm: FormGroup;
  saving = signal<boolean>(false);
  
  // Available options
  languages = [
    { value: 'he', label: 'עברית' },
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'العربية' }
  ];
  
  currencies = [
    { value: 'ILS', label: '₪ שקל ישראלי', symbol: '₪' },
    { value: 'USD', label: '$ דולר אמריקאי', symbol: '$' },
    { value: 'EUR', label: '€ אירו', symbol: '€' }
  ];

  constructor(
    private settingsService: UserSettingsService,
    private authService: AuthService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private confirmDialog: ConfirmDialogService,
    private logger: LoggerService
  ) {
    this.settingsForm = this.fb.group({
      dateRangeType: [this.dateRangeType(), Validators.required],
      showHalves: [this.showHalves()],
      language: ['he', Validators.required],
      currency: ['ILS', Validators.required],
      emailNotifications: [true],
      smsNotifications: [false],
      pushNotifications: [true]
    });
  }

  private settingsEffect = effect(() => {
    // Update form when settings change
    const settings = this.settingsService.settings();
    this.settingsForm.patchValue({
      dateRangeType: settings.dateRangeType,
      showHalves: settings.showHalves
    }, { emitEvent: false });
  });

  ngOnInit(): void {
    // Load current user
    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
    });
    
    // Load user preferences from localStorage
    this.loadUserPreferences();
  }
  
  ngOnDestroy(): void {
    // Effect cleanup is handled automatically by Angular
  }

  onDateRangeTypeChange(event: any): void {
    const newValue = event.value as DateRangeType;
    if (newValue && newValue !== this.dateRangeType()) {
      this.settingsService.updateSettings({ dateRangeType: newValue });
      this.snackBar.open('הגדרות טווח התאריכים עודכנו', 'סגור', { duration: 3000 });
    }
  }

  onSaveSettings(): void {
    if (this.settingsForm.valid) {
      this.saving.set(true);
      
      // Update date range type and showHalves
      const dateRangeType = this.settingsForm.value.dateRangeType;
      const showHalves = this.settingsForm.value.showHalves ?? false;
      this.settingsService.updateSettings({ dateRangeType, showHalves });
      
      // Note: Other settings (language, currency, notifications) are saved to localStorage
      // Backend support for these settings can be added in the future
      // TODO: Implement backend API endpoints for language, currency, and notification preferences
      const otherSettings = {
        language: this.settingsForm.value.language,
        currency: this.settingsForm.value.currency,
        emailNotifications: this.settingsForm.value.emailNotifications,
        smsNotifications: this.settingsForm.value.smsNotifications,
        pushNotifications: this.settingsForm.value.pushNotifications
      };
      localStorage.setItem('userPreferences', JSON.stringify(otherSettings));
      
      setTimeout(() => {
        this.saving.set(false);
        this.snackBar.open('ההגדרות נשמרו בהצלחה', 'סגור', { duration: 3000 });
      }, 500);
    }
  }

  resetSettings(): void {
    this.confirmDialog.confirmReset('האם אתה בטוח שברצונך לאפס את כל ההגדרות?').subscribe(confirmed => {
      if (confirmed) {
        this.settingsService.resetSettings();
        this.settingsForm.reset({
          dateRangeType: 'month-start',
          showHalves: false,
          language: 'he',
          currency: 'ILS',
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true
        });
        localStorage.removeItem('userPreferences');
        this.snackBar.open('ההגדרות אופסו לברירת מחדל', 'סגור', { duration: 3000 });
      }
    });
  }
  
  loadUserPreferences(): void {
    const prefs = localStorage.getItem('userPreferences');
    if (prefs) {
      try {
        const parsed = JSON.parse(prefs);
        this.settingsForm.patchValue(parsed, { emitEvent: false });
      } catch (e) {
        this.logger.error('Error loading preferences', e);
      }
    }
  }
}

