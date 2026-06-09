import { useState, useEffect } from "react";
import { ArrowUpRight, ArrowDownLeft, Clock, Loader2 } from "lucide-react";
import axiosClient from "../api/axiosClient";

interface TransactionHistoryProps {
  accountNumber: string;
}

// 1. UPDATED INTERFACE: Matches your C# console log exactly
interface Transaction {
  transactionId: number; 
  amount: number;
  date: string; 
  description: string;
  type: string; // 'DEBIT' or 'CREDIT'
  status?: string; // Optional, just in case it's not sent
}

export default function TransactionHistory({ accountNumber }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError("");

      try {
        const response = await axiosClient.get(`/api/accounts/${accountNumber}/transactions`);
        
        // 2. UPDATED EXTRACTION: Grabs the inner 'data' property
        const txList = response.data.data || []; 
        
        setTransactions(txList);
      } catch (err: any) {
        setError("Could not load recent transactions. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, [accountNumber]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12 mt-6 bg-white rounded-2xl border border-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-6 bg-rose-50 text-rose-600 p-4 rounded-xl text-center border border-rose-100">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6 animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <Clock className="w-5 h-5 text-brand-600" />
        <h3 className="text-lg font-bold text-slate-900">Recent Transactions</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
              <th className="p-4 font-semibold">Transaction Details</th>
              <th className="p-4 font-semibold">Date</th>
              <th className="p-4 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-12 text-center text-slate-500">
                  No recent transactions found for this account.
                </td>
              </tr>
            ) : (
              transactions.map((tx, index) => {
                // Determine if it's a credit by checking uppercase
                const isCredit = tx?.type?.toUpperCase() === 'CREDIT';

                return (
                  // 3. UPDATED KEYS & FALLBACKS: Uses transactionId
                  <tr key={tx?.transactionId || index} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                          {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{tx?.description || 'Bank Transfer'}</p>
                          <p className="text-xs text-slate-500">{tx?.status || 'Completed'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 text-sm">
                      {/* 4. UPDATED DATE PARSING: Uses tx.date */}
                      {new Date(tx?.date || new Date()).toLocaleDateString('en-IN', { 
                        day: 'numeric', month: 'short', year: 'numeric' 
                      })}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`font-bold tracking-tight ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {isCredit ? '+' : '-'}₹{(tx?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}