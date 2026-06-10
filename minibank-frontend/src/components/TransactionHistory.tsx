import { useState, useEffect } from "react";
import {  ArrowLeftRight, ChevronRight, Loader2, AlertCircle,ChevronLeft } from "lucide-react";
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
  type: "DEBIT" | "CREDIT";
  status?: string; // Optional, just in case it's not sent
}

interface PaginationMetadata{
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export default function TransactionHistory({ accountNumber }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<PaginationMetadata | null>(null);

  const [page , setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountNumber) return;
    fetchTransactions(page);
  }, [accountNumber, page]); // Re-run if the account changes or the page changes 
   
  const fetchTransactions = async (pageNumber: number) => {
      setIsLoading(true);
      setError("");

      try {
        const response = await axiosClient.get(`/api/accounts/${accountNumber}/transactions`,{
          params: {
            page: pageNumber,
            pageSize: 10
          }
        });

        setTransactions(response.data.data || []);
        setMeta(response.data.metadata);
        
      } catch (err: any) {
        setError("Could not load recent transactions. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    if (!accountNumber) return null;

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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
        <div className="bg-indigo-50 p-2 rounded-lg">
          <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Transaction Ledger</h3>
          <p className="text-sm text-slate-500 font-mono">Account: {accountNumber}</p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-6">
          <div className="p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-2 border border-rose-100">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Data Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-500 uppercase tracking-wider">
              <th className="p-4 pl-6">Date</th>
              <th className="p-4">Description</th>
              <th className="p-4 text-right">Amount (₹)</th>
              <th className="p-4 pl-6">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-slate-500">
                  No transactions found for this account.
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                // FIX 1: Use transactionId
                <tr key={tx.transactionId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 pl-6 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-900">{tx.description}</td>
                  {/* FIX 2: Check for uppercase 'CREDIT' */}
                  <td className={`p-4 text-sm font-bold text-right whitespace-nowrap ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'} {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 pl-6">
                    {/* FIX 3: Check for uppercase 'CREDIT' */}
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${tx.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {tx.type}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {meta && meta.totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <p className="text-sm text-slate-500">
            Showing page <strong className="text-slate-900">{meta.currentPage}</strong> of <strong className="text-slate-900">{meta.totalPages}</strong>
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={meta.currentPage === 1 || isLoading}
              className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-bold text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button 
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={meta.currentPage === meta.totalPages || isLoading}
              className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-bold text-slate-600"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}