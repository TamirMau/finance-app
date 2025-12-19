export interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
  type?: 'Income' | 'Expense'; // Only Income or Expense allowed
}


