import { useState, useEffect } from "react";
import { Link } from "react-router-dom"; // 🔥 ADDED THIS IMPORT
import { 
  History, Loader2, CheckCircle, XCircle, Clock, 
  Download, AlertCircle, FileSpreadsheet, RefreshCcw,
  LayoutDashboard
} from "lucide-react";
import axiosClient from "../api/axiosClient";

interface BulkBatch {
  id: number;
  fileName: string;
  uploadDate: string;
  status: "Pending" | "Processing" | "Completed" | "Failed";
  errorMessage: string | null;
  hasErrorReport: boolean;
}

export default function BulkPayrollHistory() {
  const [batches, setBatches] = useState<BulkBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchBatches = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    
    setError("");

    try {
      const response = await axiosClient.get("/api/transfers/bulk-upload/batches");
      setBatches(response.data);
    } catch (err: any) {
      setError("Failed to load batch history. Please try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    
    // Optional: Auto-refresh every 15 seconds if any batch is still Pending or Processing
    const interval = setInterval(() => {
      setBatches(currentBatches => {
        const needsRefresh = currentBatches.some(b => b.status === "Pending" || b.status === "Processing");
        if (needsRefresh) {
          fetchBatches();
        }
        return currentBatches;
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleDownloadReport = async (batchId: number) => {
    try {
      // Use standard fetch/axios but set responseType to 'blob' for file downloads
      const response = await axiosClient.get(`/api/transfers/bulk-upload/batches/${batchId}/report`, {
        responseType: 'blob'
      });

      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Batch_${batchId}_Errors.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download error report. The file may have been cleared from the server.");
    }
  };

  const getStatusBadge = (status: BulkBatch['status']) => {
    switch (status) {
      case "Completed":
        return <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100"><CheckCircle className="w-3 h-3"/> Completed</span>;
      case "Failed":
        return <span className="flex items-center gap-1 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-100"><XCircle className="w-3 h-3"/> Failed</span>;
      case "Processing":
        return <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100"><Loader2 className="w-3 h-3 animate-spin"/> Processing</span>;
      default:
        return <span className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200"><Clock className="w-3 h-3"/> Pending</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in p-8">
      
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 p-3 rounded-xl">
            <History className="text-indigo-600 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bulk Upload History</h1>
            <p className="text-slate-500 text-sm">Track your background payroll processing tasks.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium transition-colors">
              <LayoutDashboard className="w-5 h-5" /> Back
            </Link>
            
            <button 
              onClick={() => fetchBatches(true)} 
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"
            >
              <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> 
              Refresh Status
            </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-2 border border-rose-100">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-16">
            <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No bulk uploads found in your history.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-700">Batch ID</th>
                  <th className="px-6 py-4 font-bold text-slate-700">File Name</th>
                  <th className="px-6 py-4 font-bold text-slate-700">Uploaded At</th>
                  <th className="px-6 py-4 font-bold text-slate-700">Status</th>
                  <th className="px-6 py-4 font-bold text-slate-700">Remarks & Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-600">#{batch.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      {batch.fileName}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {new Date(batch.uploadDate).toLocaleString('en-IN', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(batch.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 items-start">
                        {batch.errorMessage && (
                          <span className="text-xs text-rose-600 font-medium">
                            {batch.errorMessage}
                          </span>
                        )}
                        {batch.hasErrorReport && (
                          <button 
                            onClick={() => handleDownloadReport(batch.id)}
                            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded"
                          >
                            <Download className="w-3 h-3" /> Get CSV Report
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}