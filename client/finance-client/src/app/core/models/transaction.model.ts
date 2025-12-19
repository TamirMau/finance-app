export interface Transaction {
  id: number;
  transactionDate: Date | string; // תאריך עסקה
  billingDate: Date | string;     // תאריך חיוב
  assignedMonthDate: Date | string; // תאריך שיוך לחודש - לפיו מתבצעים החישובים בדוחות
  amount: number;
  type: 'Income' | 'Expense';
  merchantName: string;            // שם בית עסק
  referenceNumber?: string;        // אסמכתא / מספר שובר
  cardNumber?: string;            // מספר כרטיס (רק 4 ספרות אחרונות)
  currency: string;               // מטבע
  installments?: number;          // מספר תשלומים
  categoryId: number;
  categoryName?: string;
  source: string;
  notes?: string;
  branch?: string;                // ענף/קטגוריה עסקית מתוך הקובץ
  IsHalves?: boolean;             // מחציות
  
  // Backward compatibility - date property maps to transactionDate
  date?: Date | string;
}

