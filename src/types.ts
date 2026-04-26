export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id?: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  description: string;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  id?: string;
  name: string;
  type: TransactionType;
  userId: string;
  color?: string;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}
