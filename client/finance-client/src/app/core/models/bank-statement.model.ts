export interface BankStatementRow {
  balance?: number | null; // יתרה
  valueDate: Date; // תאריך ערך
  debit?: number | null; // חובה
  credit?: number | null; // זכות
  reference?: string | null; // אסמכתא
  description?: string | null; // תיאור
  actionType?: string | null; // סוג פעולה
  date: Date; // תאריך
  forBenefitOf?: string | null; // לטובת
  for?: string | null; // עבור
}

export interface BankStatement {
  accountNumber: string; // מספר חשבון
  statementDate: Date; // נכון לתאריך
  balance?: number; // יתרה (מ-I6)
  rows: BankStatementRow[];
}

export interface BankStatementUploadResponse {
  success: boolean;
  message?: string;
  statement?: BankStatement;
  totalRows?: number;
}

