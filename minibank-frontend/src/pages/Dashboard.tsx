// Dashboard.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  LayoutDashboard,
  IndianRupee,
  Loader2,
  History,
  Eye,
  EyeOff,
  Send,
  FileSpreadsheet,
  History as HistoryIcon,
} from "lucide-react";
import axiosClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import TransactionHistory from "../components/TransactionHistory";
import { Link } from "react-router-dom";

// 1. THE TYPESCRIPT DEFINITION (Tells TS exactly what the C# backend returns)
interface AccountData {
  accountNumber: string;
  balance: number;
  status: string;
  accountType: number;
}

export default function Dashboard() {
  const { logout } = useAuth();

  // 2. STRICTLY TYPED UI STATE
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  // Tell TS this is an object where the Keys are strings, and Values are booleans
  const [visibleBalances, setVisibleBalances] = useState<Record<string, boolean>>({});

  // Fix: Add ': string' to the parameter
  const toggleBalance = (accountNumber: string) => {
    setVisibleBalances((prev) => ({
      ...prev,
      [accountNumber]: !prev[accountNumber],
    }));
  };

  // 3. THE REACT QUERY ENGINE (Now with <AccountData[]> generics!)
  const { data: accounts = [], isLoading, error } = useQuery<AccountData[]>({
    queryKey: ['my-accounts'],
    queryFn: async () => {
      try {
        const response = await axiosClient.get("/api/accounts/me");
        return response.data;
      } catch (err: any) { // Fix: Tell TS 'err' is 'any' so we can check err.response
        if (err.response?.status === 401) {
          logout(); 
        }
        throw new Error("Failed to load account data. Please try again later.");
      }
    }
  });

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        
        {/* Header Section */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-brand-50 p-3 rounded-xl">
              <LayoutDashboard className="text-brand-600 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">My Accounts</h1>
              <p className="text-slate-500 text-sm">Welcome to your secure dashboard.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/transfer" className="flex items-center gap-2 bg-brand-50 text-brand-700 hover:bg-brand-100 px-4 py-2 rounded-lg font-medium transition-colors">
              <Send className="w-4 h-4" /> Transfer Money
            </Link>
            <Link to="/bulk-payroll" className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2 rounded-lg font-medium transition-colors">
              <FileSpreadsheet className="w-4 h-4" /> Bulk Payroll
            </Link>
            <Link to="/bulk-payroll-history" className="flex items-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg font-medium transition-colors">
              <HistoryIcon className="w-4 h-4" /> Batch History
            </Link>
            <button onClick={logout} className="flex items-center gap-2 text-slate-500 hover:text-rose-500 font-medium transition-colors">
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </div>

        {/* Dynamic Content Section */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : error ? (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-center">
            {error.message}
          </div>
        ) : accounts.length === 0 ? (
           <div className="text-center py-8 text-slate-500">No active accounts found.</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {accounts.map((acc) => (
                <div key={acc.accountNumber} className="bg-linear-to-br from-brand-600 to-brand-900 rounded-2xl p-8 text-white shadow-lg flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-brand-100 mb-2">
                      <div className="flex items-center gap-2">
                        <IndianRupee className="w-5 h-5" />
                        <span className="font-medium uppercase tracking-wider text-sm">
                          {acc.accountType === 1 ? "Checking" : acc.accountType === 2 ? "Savings" : "Account"}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="text-4xl font-bold">
                        {visibleBalances[acc.accountNumber]
                          ? `₹${acc.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : "••••••••"}
                      </h2>
                      <button
                        onClick={() => toggleBalance(acc.accountNumber)}
                        className="text-brand-300 hover:text-white transition-colors"
                      >
                        {visibleBalances[acc.accountNumber] ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                      </button>
                    </div>

                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <p className="text-brand-200 text-sm mb-1">Account Number</p>
                        <p className="font-mono text-lg tracking-widest">{acc.accountNumber}</p>
                      </div>
                      <div className="bg-brand-500/30 px-3 py-1 rounded-full text-sm backdrop-blur-sm border border-brand-400/30">
                        {acc.status}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-brand-500/30">
                    <button
                      onClick={() => setActiveAccountId(activeAccountId === acc.accountNumber ? null : acc.accountNumber)}
                      className="w-full py-3 rounded-xl bg-brand-800 hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <History className="w-4 h-4" />
                      {activeAccountId === acc.accountNumber ? "Hide History" : "View History"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {activeAccountId && <TransactionHistory accountNumber={activeAccountId} />}
          </>
        )}
      </div>
    </div>
  );
}