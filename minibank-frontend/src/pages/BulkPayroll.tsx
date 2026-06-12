import { useState, useEffect } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, AlertCircle, LayoutDashboard, History } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";

interface AccountData {
  accountNumber: string;
  balance: number;
  accountType: number;
}

export default function BulkPayroll() {
  const navigate = useNavigate(); // <-- ADDED FOR REDIRECT

  // Form State
  const [myAccounts, setMyAccounts] = useState<AccountData[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [cutoffDate, setCutoffDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [batchErrorMsg, setBatchErrorMsg] = useState("");

  // Fetch available accounts on load
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await axiosClient.get("/api/accounts/me");
        const activeAccounts = response.data.filter((a: any) => a.status === "Active");
        setMyAccounts(activeAccounts);
        if (activeAccounts.length > 0) setSelectedAccount(activeAccounts[0].accountNumber);
      } catch (err) {
        console.error("Could not load accounts.");
      }
    };
    fetchAccounts();
  }, []);

  // Handle File Upload
  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file || !selectedAccount || !cutoffDate) return;

    setIsUploading(true);
    setBatchErrorMsg("");

    const formData = new FormData();
    formData.append("fromAccountNumber", selectedAccount);
    formData.append("file", file);
    formData.append("cuttOfDate", cutoffDate);

    try {
      await axiosClient.post("/api/transfers/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" } 
      });

      // 🔥 THE FIX: C# returned 202 Accepted! Instantly teleport user to the History Dashboard!
      navigate("/bulk-payroll-history");
      
    } catch (error: any) {
      setBatchErrorMsg(error.response?.data || "Failed to upload file. Please try again.");
      setIsUploading(false);
    } 
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <FileSpreadsheet className="text-brand-600 w-8 h-8" />
            Bulk Payroll Upload
          </h1>
          <div className="flex gap-4">
            <Link to="/bulk-payroll-history" className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium transition-colors bg-indigo-50 px-3 py-1 rounded-lg">
              <History className="w-5 h-5" /> History
            </Link>
            <Link to="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-brand-600 font-medium transition-colors">
              <LayoutDashboard className="w-5 h-5" /> Back
            </Link>
          </div>
        </div>

        {/* UPLOAD FORM */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <form onSubmit={handleUpload} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Debit Account (Sender)</label>
              <select 
                required
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 bg-slate-50 font-medium"
              >
                <option value="" disabled>Select an account...</option>
                {myAccounts.map(acc => (
                  <option key={acc.accountNumber} value={acc.accountNumber}>
                    Account (...{acc.accountNumber.slice(-4)}) - Balance: ₹{acc.balance.toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Processing Cut-off Date</label>
              <input 
                type="date" 
                required
                value={cutoffDate}
                onChange={(e) => setCutoffDate(e.target.value)}
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Upload Excel (.xlsx)</label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors">
                <UploadCloud className="w-12 h-12 text-brand-400 mb-4" />
                <input 
                  type="file" 
                  required
                  accept=".xlsx"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                />
                <p className="text-xs text-slate-400 mt-4">File must contain Account Number and Amount columns.</p>
              </div>
            </div>

            {batchErrorMsg && (
              <div className="p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-2 border border-rose-100">
                <AlertCircle className="w-5 h-5 shrink-0" /> <p>{batchErrorMsg}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isUploading || !file}
              className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors disabled:bg-slate-300 shadow-md hover:shadow-lg"
            >
              {isUploading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Upload and Process Batch"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}