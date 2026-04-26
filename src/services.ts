import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { Transaction, Category, FirestoreErrorInfo } from './types';

function handleFirestoreError(error: any, operation: string, path: string | null): never {
  const user = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: error.message,
    operationType: operation as any,
    path,
    authInfo: {
      userId: user?.uid || 'anonymous',
      email: user?.email || 'none',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || true,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || '',
      })) || [],
    }
  };
  throw new Error(JSON.stringify(errorInfo));
}

export const transactionService = {
  subscribeToTransactions: (userId: string, callback: (transactions: Transaction[]) => void) => {
    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const transactions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      // Sort by date descending on client side to avoid index requirement
      const sorted = [...transactions].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
      callback(sorted);
    }, (error) => handleFirestoreError(error, 'list', 'transactions'));
  },

  addTransaction: async (userId: string, data: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      await addDoc(collection(db, 'transactions'), {
        ...data,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'transactions');
    }
  },

  updateTransaction: async (transactionId: string, data: Partial<Transaction>) => {
    try {
      await updateDoc(doc(db, 'transactions', transactionId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'update', `transactions/${transactionId}`);
    }
  },

  deleteTransaction: async (transactionId: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', transactionId));
    } catch (error) {
      handleFirestoreError(error, 'delete', `transactions/${transactionId}`);
    }
  },

  testConnection: async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error: any) {
      if (error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  }
};

export const categoryService = {
  subscribeToCategories: (userId: string, callback: (categories: Category[]) => void) => {
    const q = query(
      collection(db, 'categories'),
      where('userId', '==', userId)
    );
    return onSnapshot(q, (snapshot) => {
      const categories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      callback(categories);
    }, (error) => handleFirestoreError(error, 'list', 'categories'));
  },

  addCategory: async (userId: string, name: string, type: 'income' | 'expense', color?: string) => {
    try {
      await addDoc(collection(db, 'categories'), {
        name,
        type,
        userId,
        color: color || '#3b82f6',
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'categories');
    }
  },

  deleteCategory: async (categoryId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (error) {
      handleFirestoreError(error, 'delete', `categories/${categoryId}`);
    }
  }
};
