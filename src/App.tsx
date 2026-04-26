/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  TrendingUp, 
  TrendingDown, 
  PieChart as PieIcon, 
  LayoutDashboard, 
  History,
  LogOut,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronRight,
  Menu,
  BarChart2,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  Building2,
  HardHat,
  Target,
  ArrowRightLeft,
  CircleDollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
  Line
} from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, startOfYear, endOfYear, eachMonthOfInterval, isSameMonth } from 'date-fns';
import { bn } from 'date-fns/locale';
import { auth } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { transactionService, categoryService } from './services';
import { Transaction, Category, TransactionType } from './types';
import { cn } from './lib/utils';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Bengali localization helper
const t = {
  appName: 'নির্মাণ ফাউন্ডেশন',
  totalIncome: 'মোট আয়',
  totalExpense: 'মোট ব্যয়',
  balance: 'অবশিষ্ট তহবিল',
  addTransaction: 'নতুন এন্ট্রি',
  recentTransactions: 'সাম্প্রতিক হিসাব',
  sectorSummary: 'খাত অনুযায়ী বিশ্লেষণ',
  income: 'আয় (Income)',
  expense: 'ব্যয় (Expense)',
  amount: 'টাকার পরিমাণ',
  category: 'হিসাবের খাত',
  date: 'তারিখ',
  description: 'বিবরণ',
  save: 'সংরক্ষণ',
  cancel: 'বন্ধ করুন',
  delete: 'মুছে দিন',
  edit: 'এডিট',
  export: 'রিপোর্ট ডাউনলোড',
  login: 'গুগল দিয়ে লগইন',
  logout: 'লগআউট',
  noData: 'কোন তথ্য নেই',
  confirmDelete: 'আপনি কি নিশ্চিত?',
  allSectors: 'সকল খাত',
  filter: 'ফিল্টার',
  search: 'খুঁজুন',
  summary: 'ড্যাশবোর্ড',
  actions: 'অ্যাকশন',
  newCategory: 'নতুন খাত',
  transactionType: 'লেনদেনের ধরন',
  history: 'বিস্তারিত ইতিহাস',
  analytics: 'গ্রাফ বিশ্লেষণ',
  daily: 'দৈনিক',
  monthly: 'মাসিক',
  yearly: 'বার্ষিক',
  foodAnalysis: 'খাদ্য খাত বিশ্লেষণ',
  otherAnalysis: 'অন্যান্য খাত বিশ্লেষণ',
};

const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'categories' | 'analytics' | 'food'>('dashboard');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [dashboardDrillDown, setDashboardDrillDown] = useState<'none' | 'income' | 'expense'>('none');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preselectedCategory, setPreselectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      transactionService.testConnection();
      const unsubT = transactionService.subscribeToTransactions(user.uid, setTransactions);
      const unsubC = categoryService.subscribeToCategories(user.uid, setCategories);
      return () => {
        unsubT();
        unsubC();
      };
    }
  }, [user]);

  const handleDeleteTransaction = async (id: string) => {
    if (!id) return;
    try {
      await transactionService.deleteTransaction(id);
    } catch (error: any) {
      console.error("Delete Error:", error);
      alert("মুছে ফেলা সম্ভব হয়নি। আপনি কি লগইন করা আছেন?");
    }
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setTransactions([]);
    setCategories([]);
    setDashboardDrillDown('none');
  };

  const dashboardStats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    
    const incomeBySource: Record<string, number> = {};
    transactions.filter(t => t.type === 'income').forEach(t => {
      incomeBySource[t.category] = (incomeBySource[t.category] || 0) + t.amount;
    });

    const expenseBySource: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      expenseBySource[t.category] = (expenseBySource[t.category] || 0) + t.amount;
    });

    return {
      income,
      expense,
      balance: income - expense,
      incomeSources: Object.entries(incomeBySource).map(([name, value]) => ({ name, value })),
      expenseSources: Object.entries(expenseBySource).map(([name, value]) => ({ name, value }))
    };
  }, [transactions]);

  const chartData = useMemo(() => {
    const sectors: Record<string, number> = {};
    transactions
      .filter(txn => txn.type === 'expense')
      .forEach(txn => {
        sectors[txn.category] = (sectors[txn.category] || 0) + txn.amount;
      });
    return Object.entries(sectors).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const foodChartData = useMemo(() => {
    const foodExpenses = transactions.filter(txn => 
      txn.type === 'expense' && (txn.category.includes('খাদ্য') || txn.category.includes('Food'))
    );
    const sectors: Record<string, number> = {};
    foodExpenses.forEach(txn => {
      sectors[txn.description || 'খাদ্য'] = (sectors[txn.description || 'খাদ্য'] || 0) + txn.amount;
    });
    return Object.entries(sectors).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const nonFoodChartData = useMemo(() => {
    const nonFoodExpenses = transactions.filter(txn => 
      txn.type === 'expense' && !(txn.category.includes('খাদ্য') || txn.category.includes('Food'))
    );
    const sectors: Record<string, number> = {};
    nonFoodExpenses.forEach(txn => {
      sectors[txn.category] = (sectors[txn.category] || 0) + txn.amount;
    });
    return Object.entries(sectors).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const exportToExcel = () => {
    // Standardized Excel for Print/Read
    const header = [
      [t.appName],
      ["আর্থিক প্রতিবেদন ও হিসাব বিবরণী"],
      [`তারিখ: ${format(new Date(), 'dd/MM/yyyy')}`],
      [], // Empty row
      ["তারিখ", "ধরন", "খাত", "বিবরণ", "পরিমাণ"]
    ];

    const dataRows = transactions.map(txn => [
      format(new Date(txn.date), 'dd/MM/yyyy'),
      txn.type === 'income' ? 'আয়' : 'ব্যয়',
      txn.category,
      txn.description,
      txn.amount
    ]);

    const worksheetData = [...header, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Date
      { wch: 10 }, // Type
      { wch: 20 }, // Category
      { wch: 40 }, // Description
      { wch: 15 }  // Amount
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financial Report");
    XLSX.writeFile(wb, `nirman_foundation_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Foundation Header
    doc.setFontSize(22);
    doc.setTextColor(16, 185, 129); // Emerald-500
    doc.text(t.appName, 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("আর্থিক প্রতিবেদন ও হিসাব বিবরণী", 105, 28, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(20, 35, 190, 35);

    // Summary Stats
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(`${t.totalIncome}: TK ${dashboardStats.income.toLocaleString()}`, 20, 45);
    doc.text(`${t.totalExpense}: TK ${dashboardStats.expense.toLocaleString()}`, 20, 52);
    doc.text(`${t.balance}: TK ${dashboardStats.balance.toLocaleString()}`, 20, 59);
    
    const tableColumn = ["Date", "Type", "Category", "Description", "Amount"];
    const tableRows: any[] = [];

    transactions.forEach(txn => {
      const txnData = [
        format(new Date(txn.date), 'dd/MM/yyyy'),
        txn.type === 'income' ? 'Income' : 'Expense',
        txn.category,
        txn.description,
        `TK ${txn.amount.toLocaleString()}`
      ];
      tableRows.push(txnData);
    });

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 70,
      theme: 'grid',
      headStyles: { fillStyle: 'dark', fillColor: [16, 185, 129] },
      styles: { fontSize: 9 }
    });
    
    doc.save(`nirman_foundation_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportData = () => {
    exportToExcel();
    exportToPDF();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fdfdfb]">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fdfdfb] flex flex-col items-center justify-center p-6 text-[#1a1c18]">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="space-y-2">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <LayoutDashboard size={40} />
            </div>
            <h1 className="text-4xl font-bold tracking-tight">{t.appName}</h1>
            <p className="text-gray-500">ফাউন্ডেশনের আয়-ব্যয়ের হিসাব রাখার আধুনিক মাধ্যম</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#1a1c18] text-white px-8 py-4 rounded-xl font-medium hover:bg-black transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            {t.login}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 md:relative md:translate-x-0 outline-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
               <Building2 size={24} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-slate-800 leading-tight">{t.appName}</h1>
              <span className="text-[9px] text-emerald-600 font-black uppercase tracking-[0.2em]">Nirman Foundation</span>
            </div>
          </div>

          <nav className="flex-1 space-y-1">
            <NavBtn active={activeTab === 'dashboard'} icon={<LayoutDashboard size={18}/>} label={t.summary} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
            <NavBtn active={activeTab === 'analytics'} icon={<BarChart2 size={18}/>} label={t.analytics} onClick={() => { setActiveTab('analytics'); setIsSidebarOpen(false); }} />
            <NavBtn active={activeTab === 'food'} icon={<TrendingUp size={18}/>} label={t.foodAnalysis} onClick={() => { setActiveTab('food'); setIsSidebarOpen(false); }} />
            <NavBtn active={activeTab === 'history'} icon={<History size={18}/>} label={t.history} onClick={() => { setActiveTab('history'); setHistoryFilter('all'); setIsSidebarOpen(false); }} />
            <NavBtn active={activeTab === 'categories'} icon={<PieIcon size={18}/>} label={t.category} onClick={() => { setActiveTab('categories'); setIsSidebarOpen(false); }} />
          </nav>

          <div className="pt-6 border-t border-slate-100 space-y-1">
            <button 
              onClick={exportData}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download size={18} />
              <span>{t.export}</span>
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut size={18} />
              <span>{t.logout}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 -ml-2 text-slate-600" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={24} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{activeTab === 'dashboard' ? t.summary : activeTab === 'history' ? t.history : t.category}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              {user.displayName || user.email}
            </div>
            <button 
              onClick={() => { setEditingId(null); setShowAddModal(true); }}
              className="flex items-center gap-2 bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-100"
            >
              <Plus size={18} />
              <span>{t.addTransaction}</span>
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard 
              stats={dashboardStats} 
              activeDrillDown={dashboardDrillDown}
              onStatClick={(type: any) => {
                setDashboardDrillDown(prev => prev === type ? 'none' : type);
              }}
              chartData={chartData} 
              recentTransactions={transactions} 
              onEdit={(id) => { setEditingId(id); setShowAddModal(true); }}
              onDelete={handleDeleteTransaction}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsView transactions={transactions} />
          )}
          {activeTab === 'food' && (
            <FoodAnalysisView 
              transactions={transactions} 
              onAddTransaction={() => { 
                setEditingId(null); 
                setPreselectedCategory('খাদ্য');
                setShowAddModal(true); 
              }}
            />
          )}
          {activeTab === 'history' && (
            <HistoryView 
              transactions={transactions} 
              filter={historyFilter}
              onEdit={(id) => { setEditingId(id); setShowAddModal(true); }}
              onDelete={handleDeleteTransaction}
            />
          )}
          {activeTab === 'categories' && (
            <CategoriesView 
              categories={categories} 
              onAdd={async (name, type) => {
                try {
                  await categoryService.addCategory(user.uid, name, type);
                } catch (error: any) {
                  console.error("Category Save Error:", error);
                  alert("দুঃখিত, খাত সংরক্ষণ করা সম্ভব হয়নি।");
                }
              }}
              onDelete={categoryService.deleteCategory}
            />
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <TransactionModal 
            userId={user.uid}
            categories={categories}
            editingId={editingId}
            preselectedCategory={preselectedCategory}
            existingTransaction={transactions.find(txn => txn.id === editingId)}
            onClose={() => { setShowAddModal(false); setPreselectedCategory(null); }}
            onSave={async (data: any) => {
              try {
                if (editingId) {
                  await transactionService.updateTransaction(editingId, data);
                } else {
                  await transactionService.addTransaction(user.uid, data);
                }
                setShowAddModal(false);
              } catch (error: any) {
                console.error("Transaction Save Error:", error);
                let message = "দুঃখিত, লেনদেন সংরক্ষণ করা সম্ভব হয়নি।";
                try {
                  const errorInfo = JSON.parse(error.message);
                  message += `\nত্রুটি: ${errorInfo.error}`;
                } catch (e) {
                  message += `\n${error.message}`;
                }
                alert(message);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NavBtn({ active, icon, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
        active ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <span className={cn(active ? "text-emerald-700" : "text-slate-400")}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Dashboard({ stats, activeDrillDown, onStatClick, chartData, recentTransactions, onEdit, onDelete }: any) {
  const sources = activeDrillDown === 'income' ? stats.incomeSources : stats.expenseSources;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="space-y-6"
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Bento Grid layout */}
        <StatCard 
          title={t.totalIncome} 
          value={stats.income} 
          active={activeDrillDown === 'income'}
          color="white" 
          onClick={() => onStatClick('income')}
          className={cn(
            "col-span-12 md:col-span-4 cursor-pointer border-2 transition-all active:scale-95 shadow-sm",
            activeDrillDown === 'income' ? "border-emerald-500 bg-emerald-50/50" : "border-transparent hover:border-emerald-100"
          )} 
        />
        <StatCard 
          title={t.totalExpense} 
          value={stats.expense} 
          active={activeDrillDown === 'expense'}
          color="white" 
          onClick={() => onStatClick('expense')}
          className={cn(
            "col-span-12 md:col-span-4 cursor-pointer border-2 transition-all active:scale-95 shadow-sm",
            activeDrillDown === 'expense' ? "border-rose-500 bg-rose-50/50" : "border-transparent hover:border-rose-100"
          )} 
        />
        <StatCard 
          title={t.balance} 
          value={stats.balance} 
          color="emerald" 
          className="col-span-12 md:col-span-4 bg-emerald-800 text-white shadow-lg shadow-emerald-100" 
        />

          <AnimatePresence>
          {activeDrillDown !== 'none' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="col-span-12 overflow-hidden mx-auto w-full"
            >
              <div className={cn(
                "p-8 rounded-[2rem] border bg-white shadow-xl space-y-6",
                "border-emerald-200"
              )}>
                <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", activeDrillDown === 'income' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600")}>
                      {activeDrillDown === 'income' ? <TrendingUp size={24}/> : <TrendingDown size={24}/>}
                    </div>
                    {activeDrillDown === 'income' ? 'আয়ের উৎসসমূহ' : 'ব্যয়ের উৎসসমূহ'}
                  </h3>
                  <button onClick={() => onStatClick('none')} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                  {sources.map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between group py-2 border-b border-slate-50 border-dashed last:border-0 hover:border-emerald-200 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2 h-2 rounded-full", activeDrillDown === 'income' ? "bg-emerald-500" : "bg-rose-500")}></div>
                        <span className="text-sm font-semibold text-slate-700">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">টাকা</span>
                        <span className="font-mono text-lg font-black text-slate-900 tracking-tight">
                          {s.value.toLocaleString('bn-BD')}
                        </span>
                      </div>
                    </div>
                  ))}
                  {sources.length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-400 italic font-medium">
                      {t.noData}
                    </div>
                  )}
                </div>
                
                <div className="bg-slate-50 p-4 rounded-xl flex justify-between items-center px-6">
                   <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">মোট অংশ</span>
                   <span className="text-xl font-black text-emerald-700">৳ {sources.reduce((a: any, b: any) => a + b.value, 0).toLocaleString('bn-BD')}</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analysis Box */}
        <div className="col-span-12 md:col-span-8 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold mb-6 flex items-center gap-2 text-slate-800 uppercase tracking-widest">
            <PieIcon size={16} className="text-slate-400" />
            {t.sectorSummary}
          </h3>
          <div className="h-[300px]">
             {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300 italic text-xs">
                {t.noData}
              </div>
            )}
          </div>
        </div>

        {/* Budget/Goal Box */}
        <div className="col-span-12 md:col-span-4 bg-emerald-900 p-6 rounded-2xl shadow-xl text-white flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-60 mb-6 flex items-center gap-2">
              <Target size={14} />
              মাসিক বাজেট লক্ষ্য
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span>খরচের সীমা</span>
                  <span>৭০%</span>
                </div>
                <div className="w-full bg-black/20 h-2 rounded-full">
                   <div className="h-full bg-emerald-400 rounded-full" style={{ width: '70%' }}></div>
                </div>
              </div>
              <p className="text-[10px] text-emerald-200/60 leading-relaxed italic">আপনার ব্যয়ের লক্ষ্যমাত্রা অনুযায়ী সঞ্চয় বজায় রাখতে সহায়তা করবে।</p>
            </div>
          </div>
          <div className="mt-8">
            <button className="w-full bg-white/10 hover:bg-white/20 px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-white/10">
               লক্ষ্য নির্ধারণ করুন
               <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Recent Transactions list */}
        <div className="col-span-12 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <ArrowRightLeft size={18} className="text-emerald-600" />
              {t.recentTransactions}
            </h3>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
               সর্বশেষ ১০টি লেনদেন
            </span>
          </div>
          <div className="space-y-1">
            {recentTransactions.slice(0, 10).map((txn: Transaction) => (
              <TransactionItem key={txn.id || Math.random().toString()} transaction={txn} onEdit={onEdit} onDelete={onDelete} />
            ))}
            {recentTransactions.length === 0 && (
              <div className="text-center py-20 text-slate-300 italic text-sm">
                {t.noData}
              </div>
            )}
          </div>
          <div className="mt-6 pt-6 border-t border-slate-50 flex justify-center">
             <button onClick={() => {}} className="text-xs font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700 transition-colors">
                আরও দেখুন
             </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AnalyticsView({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<'daily' | 'monthly' | 'yearly'>('daily');

  const analyticsData = useMemo(() => {
    const data: any[] = [];
    const now = new Date();

    if (range === 'daily') {
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

      days.forEach(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayTransactions = transactions.filter(txn => txn.date === dayStr);
        data.push({
          label: format(day, 'dd'),
          income: dayTransactions.filter(txn => txn.type === 'income').reduce((acc, curr) => acc + curr.amount, 0),
          expense: dayTransactions.filter(txn => txn.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0),
        });
      });
    } else if (range === 'monthly') {
      const yearStart = startOfYear(now);
      const yearEnd = endOfYear(now);
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      months.forEach(month => {
        const monthTransactions = transactions.filter(txn => {
          const txnDate = new Date(txn.date);
          return isSameMonth(txnDate, month);
        });
        data.push({
          label: format(month, 'MMM'),
          income: monthTransactions.filter(txn => txn.type === 'income').reduce((acc, curr) => acc + curr.amount, 0),
          expense: monthTransactions.filter(txn => txn.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0),
        });
      });
    } else if (range === 'yearly') {
      // Last 5 years
      for (let i = 4; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const yearTransactions = transactions.filter(txn => new Date(txn.date).getFullYear() === year);
        data.push({
          label: year.toString(),
          income: yearTransactions.filter(txn => txn.type === 'income').reduce((acc, curr) => acc + curr.amount, 0),
          expense: yearTransactions.filter(txn => txn.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0),
        });
      }
    }
    return data;
  }, [transactions, range]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">{t.analytics}</h2>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <RangeBtn active={range === 'daily'} label={t.daily} onClick={() => setRange('daily')} />
          <RangeBtn active={range === 'monthly'} label={t.monthly} onClick={() => setRange('monthly')} />
          <RangeBtn active={range === 'yearly'} label={t.yearly} onClick={() => setRange('yearly')} />
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={analyticsData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                tickFormatter={(val) => `৳${val >= 1000 ? (val/1000) + 'k' : val}`}
              />
              <RechartsTooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', borderShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Legend verticalAlign="top" align="right" height={36} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              <Area type="monotone" dataKey="income" fill="#10b981" stroke="#10b981" fillOpacity={0.05} strokeWidth={2} name="আয়" />
              <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={range === 'daily' ? 10 : 30} name="ব্যয়" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-800 p-6 rounded-2xl text-white shadow-xl">
           <TrendingUp className="mb-4 text-emerald-300" size={32} />
           <p className="text-xs font-bold uppercase tracking-widest opacity-60">এই পিরিয়ডের মোট আয়</p>
           <h3 className="text-3xl font-bold mt-1">৳ {analyticsData.reduce((acc, curr) => acc + curr.income, 0).toLocaleString('bn-BD')}</h3>
        </div>
        <div className="bg-rose-800 p-6 rounded-2xl text-white shadow-xl">
           <TrendingDown className="mb-4 text-rose-300" size={32} />
           <p className="text-xs font-bold uppercase tracking-widest opacity-60">এই পিরিয়ডের মোট ব্যয়</p>
           <h3 className="text-3xl font-bold mt-1">৳ {analyticsData.reduce((acc, curr) => acc + curr.expense, 0).toLocaleString('bn-BD')}</h3>
        </div>
      </div>
    </motion.div>
  );
}

function RangeBtn({ active, label, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-6 py-2 rounded-lg text-xs font-bold transition-all",
        active ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
      )}
    >
      {label}
    </button>
  );
}

function FoodAnalysisView({ transactions, onAddTransaction }: any) {
  const foodTransactions = useMemo(() => {
    return transactions.filter((txn: Transaction) => 
      txn.type === 'expense' && (txn.category.toLowerCase().includes('food') || txn.category.includes('খাদ্য'))
    );
  }, [transactions]);

  const foodSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    foodTransactions.forEach(txn => {
      summary[txn.description] = (summary[txn.description] || 0) + txn.amount;
    });
    return Object.entries(summary).map(([name, value]) => ({ name, value }));
  }, [foodTransactions]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">{t.foodAnalysis}</h2>
        <button 
          onClick={onAddTransaction}
          className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-700 transition-colors"
        >
          <Plus size={18} />
          খাদ্য সামগ্রী যোগ করুন
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-100 p-6 rounded-2xl flex flex-col justify-center">
          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-1">মোট খাদ্য ব্যয়</span>
          <h3 className="text-3xl font-bold text-orange-900">৳ {foodTransactions.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString('bn-BD')}</h3>
        </div>
        
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[300px]">
           <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-widest">খাদ্য আইটেম বিশ্লেষণ</h3>
           <div className="h-[250px]">
              {foodSummary.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={foodSummary}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <RechartsTooltip />
                    <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 italic text-xs">
                  কোন খাদ্য বিষয়ক লেনদেন পাওয়া যায়নি
                </div>
              )}
           </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs uppercase tracking-widest text-slate-500">
          খাদ্য আইটেম তালিকা
        </div>
        <div className="divide-y divide-slate-100">
          {foodTransactions.map((txn: Transaction) => (
             <div key={txn.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{txn.description}</p>
                  <p className="text-[10px] text-slate-400">{format(new Date(txn.date), 'dd MMMM yyyy', { locale: bn })}</p>
                </div>
                <span className="font-mono font-bold text-orange-600">৳ {txn.amount.toLocaleString('bn-BD')}</span>
             </div>
          ))}
          {foodTransactions.length === 0 && (
            <div className="p-10 text-center text-slate-300 italic text-sm">{t.noData}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ title, value, color, active, onClick, className }: any) {
  const isEmerald = color === 'emerald';
  return (
    <motion.div 
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "p-6 rounded-[1.5rem] border shadow-sm flex flex-col justify-center transition-all duration-300 relative overflow-hidden", 
        className, 
        active 
          ? "bg-emerald-600 border-emerald-500 text-white ring-4 ring-emerald-500/20 shadow-emerald-200" 
          : isEmerald 
            ? "bg-emerald-800 border-emerald-900 text-white shadow-lg shadow-emerald-100" 
            : "bg-white border-slate-100 hover:border-emerald-200"
      )}
    >
      {active && (
        <motion.div 
          layoutId="active-bg"
          className="absolute inset-0 bg-emerald-600 z-0"
        />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className={cn(
            "text-[11px] font-black uppercase tracking-[0.2em]", 
            active || isEmerald ? "text-emerald-100/70" : "text-slate-400"
          )}>
            {title}
          </span>
          {!isEmerald && (
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300", 
              active ? "bg-white text-emerald-700" : "bg-slate-50 text-slate-300"
            )}>
               <ChevronRight size={16} className={cn("transition-transform duration-300", active ? "rotate-90" : "rotate-0")} />
            </div>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "text-3xl font-black tracking-tight font-sans", 
            active || isEmerald ? "text-white" : "text-slate-900"
          )}>
            ৳ {value.toLocaleString('bn-BD')}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function TransactionItem({ transaction, onEdit, onDelete }: any) {
  const isIncome = transaction.type === 'income';
  return (
    <div className="group flex items-center justify-between p-4 rounded-2xl border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-all">
      <div className="flex items-center gap-4 min-w-0">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0",
          isIncome ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {isIncome ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 truncate font-sans text-sm">{transaction.description || transaction.category}</p>
            <span className="hidden sm:inline px-2 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-black uppercase tracking-widest border border-slate-200">
              {transaction.category}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
            <span>{format(new Date(transaction.date), 'dd MMMM yyyy', { locale: bn })}</span>
            <span className="sm:hidden">• {transaction.category}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 pl-4">
        <span className={cn("font-sans font-black text-lg tracking-tight", isIncome ? "text-emerald-600" : "text-rose-600")}>
          {isIncome ? '+' : '-'} ৳ {transaction.amount.toLocaleString('bn-BD')}
        </span>
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(transaction.id); }} 
            className="p-2.5 text-slate-400 hover:text-emerald-600 transition-colors bg-white rounded-xl shadow-sm border border-slate-100"
            title={t.edit}
          >
            <Edit2 size={16} />
          </button>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              if(window.confirm('আপনি কি এই হিসাবটি নিশ্চিতভাবে মুছে ফেলতে চান? এটি আর ফিরে পাওয়া যাবে না।')) {
                onDelete(transaction.id); 
              }
            }} 
            className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors bg-white rounded-xl shadow-sm border border-slate-100"
            title={t.delete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryView({ transactions, filter, onEdit, onDelete }: any) {
  const [filterType, setFilterType] = useState<string>(filter || 'all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (filter) setFilterType(filter);
  }, [filter]);

  const filtered = transactions.filter((txn: Transaction) => {
    const matchesFilter = filterType === 'all' || txn.type === filterType;
    const matchesSearch = txn.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          txn.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800">{t.history}</h2>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="all">{t.filter}: সব</option>
            <option value="income">{t.income}</option>
            <option value="expense">{t.expense}</option>
          </select>
          <div className="relative flex-1 sm:w-64">
            <input 
              type="text" 
              placeholder={t.search} 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-4 pr-10 py-2 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto text-[13px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 uppercase tracking-[0.1em] text-slate-400 font-bold">
                <th className="px-6 py-4 text-[10px]">{t.date}</th>
                <th className="px-6 py-4 text-[10px]">{t.description}</th>
                <th className="px-6 py-4 text-[10px] text-center">{t.category}</th>
                <th className="px-6 py-4 text-[10px] text-right">{t.amount}</th>
                <th className="px-6 py-4 text-[10px] text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((txn: Transaction) => (
                <tr key={txn.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-500 font-medium">{format(new Date(txn.date), 'dd/MM/yyyy')}</td>
                  <td className="px-6 py-4 font-bold text-slate-800">{txn.description}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                      {txn.category}
                    </span>
                  </td>
                  <td className={cn("px-6 py-4 font-mono font-bold text-right", txn.type === 'income' ? "text-emerald-600" : "text-rose-600")}>
                    {txn.type === 'income' ? '+' : '-'} ৳ {txn.amount.toLocaleString('bn-BD')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <button onClick={() => onEdit(txn.id)} className="p-2 text-slate-300 hover:text-emerald-600 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => { if(confirm(t.confirmDelete)) onDelete(txn.id); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-20 text-slate-300 italic">
              {t.noData}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CategoriesView({ categories, onAdd, onDelete }: any) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <h2 className="text-xl font-bold text-slate-800">{t.category}</h2>
      
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4 lg:col-span-4 space-y-4">
          <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">{t.newCategory}</h3>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{t.category}</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-4 text-base font-bold placeholder-slate-300 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/30 transition-all font-sans"
                  placeholder="খাতের নাম... (যেমন: যাতায়াত)"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">{t.transactionType}</label>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => setType('income')}
                    className={cn("px-6 py-5 rounded-2xl text-sm font-black transition-all border-2 flex items-center justify-center gap-3", 
                      type === 'income' ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-100 scale-[1.02]" : "bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200")}
                  >
                    <TrendingUp size={20} />
                    {t.income}
                  </button>
                  <button 
                    onClick={() => setType('expense')}
                    className={cn("px-6 py-5 rounded-2xl text-sm font-black transition-all border-2 flex items-center justify-center gap-3", 
                      type === 'expense' ? "bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-100 scale-[1.02]" : "bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-200")}
                  >
                    <TrendingDown size={20} />
                    {t.expense}
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => { if(name) { onAdd(name, type); setName(''); } }}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl hover:shadow-2xl active:scale-[0.98]"
            >
              <Plus size={24} />
              {t.save}
            </button>
          </div>
        </div>

        <div className="col-span-12 md:col-span-8 lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-[11px] font-black text-emerald-600 px-4 uppercase tracking-[0.2em] flex items-center gap-2">
                 <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                 {t.income} খাত
              </h4>
              <div className="space-y-3">
                {categories.filter((c: Category) => c.type === 'income').map((c: Category) => (
                  <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                    <span className="font-bold text-slate-800 text-sm font-sans">{c.name}</span>
                    <button 
                      onClick={() => { if(confirm('আপনি কি এই খাতটি মুছে ফেলতে চান?')) onDelete(c.id); }} 
                      className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-[11px] font-black text-rose-600 px-4 uppercase tracking-[0.2em] flex items-center gap-2">
                 <div className="w-1.5 h-4 bg-rose-500 rounded-full"></div>
                 {t.expense} খাত
              </h4>
              <div className="space-y-3">
                  {categories.filter((c: Category) => c.type === 'expense').map((c: Category) => (
                  <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                    <span className="font-bold text-slate-800 text-sm font-sans">{c.name}</span>
                    <button 
                      onClick={() => { if(confirm('আপনি কি এই খাতটি মুছে ফেলতে চান?')) onDelete(c.id); }} 
                      className="p-2 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TransactionModal({ userId, categories, existingTransaction, editingId, preselectedCategory, onClose, onSave }: any) {
  const [type, setType] = useState<TransactionType>(existingTransaction?.type || 'expense');
  const [amount, setAmount] = useState(existingTransaction?.amount.toString() || '');
  const [category, setCategory] = useState(existingTransaction?.category || preselectedCategory || '');
  const [date, setDate] = useState(existingTransaction?.date || format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState(existingTransaction?.description || '');
  const [isSaving, setIsSaving] = useState(false);

  const filteredCategories = categories.filter((c: Category) => c.type === type);

  useEffect(() => {
    if (!category && !preselectedCategory && filteredCategories.length > 0) {
      setCategory(filteredCategories[0].name);
    }
  }, [type, filteredCategories, category, preselectedCategory]);

  const handleSubmit = async () => {
    if (!amount || !category) return;
    setIsSaving(true);
    try {
      await onSave({
        type,
        amount: parseFloat(amount),
        category,
        date,
        description
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl overflow-hidden border border-slate-200"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-slate-800">{editingId ? t.edit : t.addTransaction}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">{t.transactionType}</label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
              <button 
                onClick={() => setType('income')}
                className={cn("py-2 rounded-lg text-xs font-bold transition-all", 
                  type === 'income' ? "bg-white text-emerald-700 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                {t.income}
              </button>
              <button 
                onClick={() => setType('expense')}
                className={cn("py-2 rounded-lg text-xs font-bold transition-all", 
                  type === 'expense' ? "bg-white text-rose-700 shadow-sm" : "text-slate-400 hover:text-slate-600")}
              >
                {t.expense}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t.amount} (৳)</label>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-mono font-bold text-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t.date}</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t.category}</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">খাত নির্বাচন করুন</option>
              {filteredCategories.map((c: Category) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{t.description}</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="বিস্তারিত বিবরণ..."
              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              disabled={isSaving}
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button 
              disabled={isSaving}
              onClick={handleSubmit}
              className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                 <motion.div 
                   animate={{ rotate: 360 }}
                   transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                   className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                 />
              ) : (editingId ? 'আপডেট করুন' : t.save)}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

