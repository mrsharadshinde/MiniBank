import { useState, useEffect } from "react";
import { 
  ArrowLeftRight, ChevronRight, Loader2, AlertCircle, ChevronLeft, 
  Filter, Download, RefreshCcw 
} from "lucide-react";
import axiosClient from "../api/axiosClient";

interface TransactionHistoryProps {
  accountNumber: string;
}

interface Transaction {
  transactionId: number; 
  amount: number;
  date: string; 
  description: string;
  type: "DEBIT" | "CREDIT";
  status?: string; 
}

interface PaginationMetadata {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}

export default function TransactionHistory({ accountNumber }: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [meta, setMeta] = useState<PaginationMetadata | null>(null);

  // --- FILTER & PAGINATION STATE --------------------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountNumber) return;
    fetchTransactions(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNumber, page, pageSize]); // Auto-fetch when account, page, or pageSize changes

  const fetchTransactions = async (pageNumber: number) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await axiosClient.get(`/api/accounts/${accountNumber}/transactions`, {
        params: {
          page: pageNumber,
          pageSize: pageSize,
          startDate: startDate || undefined, // Only send if user selected a date
          endDate: endDate || undefined
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

  const handleApplyFilters = () => {
    // Resetting to page 1 will automatically trigger the useEffect to fetch data
    if (page === 1) {
      fetchTransactions(1);
    } else {
      setPage(1); 
    }
  };

  const handleClearFilters =  () => {
    setStartDate("");
    setEndDate("");
    setPageSize(10);
    if (page === 1) {
      // Force fetch since resetting state won't trigger effect if page is already 1
      setTimeout(() => fetchTransactions(1), 0); 
    } else {
      setPage(1);
    }
  };
// _______--------------------------------------------------
  const handleExport = async () => {
    // TODO: Implement CSV/PDF export logic later
    try{
      setIsExporting(true);
      setError("");

      // 1. Fetch all records matching the current date filter (bypassing small page limit)
      const response = await axiosClient.get(`/api/accounts/${accountNumber}/transactions`,{
        params: {
          page: 1,
          pageSize: 1000,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }
      });

      const exportData: Transaction[] = response.data.data || [];

      if(exportData.length === 0){
        setError("No transaction available to export for this date ranfe");
        return;
      }

      // 2. Define CSV Headers
      const headers = ["Transaction ID", "Date", "Description", "Type", "Amount (INR)", "Status"];

      // 3. Map Data to CSV Rows (Ensuring text fields with commas are wrapped in quotes)
      const csvRows = exportData.map(tx => {
        const formatDate = new Date(tx.date).toLocaleString('en-IN', {
          year: 'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit'
        });

        // Escape quotes inside descriptions to prevent CSV breaking 
        const safeDescription = `"${tx.description.replace(/"/g, '""')}"`;

        return [
          tx.transactionId,
          `"${formatDate}"`,
          safeDescription,
          tx.type,
          tx.amount,
          tx.status || "Completed"
        ].join(",");
      });

      // 4. Combbine the headers and rows 
      const csvContent = [headers.join(","), ...csvRows].join("\n");
      
      // 5. Create a Blob and trigger the browser download 
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `MiniBank_statement_${accountNumber}_${new Date().getTime()}.csv`);
      document.body.appendChild(link);
      link.click();

      //6. Cleanup 
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    }catch(err){
      setError("Failed to genreate the export file. Please try again");
    }finally{
      setIsExporting(false);
    }
    
  };


  if (!accountNumber) return null;

  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex justify-center py-12 mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-lg">
            <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Transaction Ledger</h3>
            <p className="text-sm text-slate-500 font-mono">Account: {accountNumber}</p>
          </div>
        </div>
        
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
          <Download className="w-4 h-4" /> Export Statement
        </button>
      </div>

      {/* --- NEW: FILTER TOOLBAR --- */}
      <div className="p-4 border-b border-slate-100 bg-white grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Show Rows</label>
          <select 
            value={pageSize} 
            onChange={(e) => setPageSize(Number(e.target.value))} 
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value={10}>10 records</option>
            <option value={25}>25 records</option>
            <option value={50}>50 records</option>
          </select>
        </div>
        <div className="md:col-span-4 flex gap-2">
          <button onClick={handleApplyFilters} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors">
            <Filter className="w-4 h-4" /> Apply Filter
          </button>
          <button onClick={handleClearFilters} className="flex-none flex items-center justify-center p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors" title="Clear Filters">
            <RefreshCcw className="w-4 h-4" />
          </button>
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
      <div className="overflow-x-auto relative min-h-50">
        {isLoading && transactions.length > 0 && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        )}
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
            {transactions.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Filter className="w-8 h-8 text-slate-300" />
                    <p>No transactions match your filters.</p>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.transactionId} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 pl-6 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(tx.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                  </td>
                  <td className="p-4 text-sm font-medium text-slate-900">{tx.description}</td>
                  <td className={`p-4 text-sm font-bold text-right whitespace-nowrap ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'} {tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 pl-6">
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
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-slate-50/50 gap-4">
          <p className="text-sm text-slate-500">
            Showing page <strong className="text-slate-900">{meta.currentPage}</strong> of <strong className="text-slate-900">{meta.totalPages}</strong> 
            {" "}({meta.totalRecords} total records)
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={meta.currentPage === 1 || isLoading}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-bold text-slate-600"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button 
              onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
              disabled={meta.currentPage === meta.totalPages || isLoading}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1 text-sm font-bold text-slate-600"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}