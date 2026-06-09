import { useState, useEffect } from "react";
import { UploadCloud, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2, Download, LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";

interface AccountData {
  accountNumber: string;
  balance: number;
  accountType: number;
}

export default function BulkPayroll() {

  // Form State
  const [myAccounts, setMyAccounts] = useState<AccountData[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [cutoffDate, setCutoffDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Upload & Hangfire Processing State
  const [isUploading, setIsUploading] = useState(false);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [batchStatus, setBatchStatus] = useState<string>(""); 
  const [batchErrorMsg, setBatchErrorMsg] = useState("");
  const [hasErrorFile, setHasErrorFile] = useState(false);

  // 1. Fetch available accounts on load
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await axiosClient.get("/api/accounts/me");
        // Usually, only Business accounts (Type 3) do bulk payroll, but we'll show all active ones
        const activeAccounts = response.data.filter((a: any) => a.status === "Active");
        setMyAccounts(activeAccounts);
        if (activeAccounts.length > 0) setSelectedAccount(activeAccounts[0].accountNumber);
      } catch (err) {
        console.error("Could not load accounts.");
      }
    };
    fetchAccounts();
  }, []);

  // 2. Poll Hangfire for Status Updates (Runs every 3 seconds if processing)
  useEffect(() => {
    // FIX: Using ReturnType makes this safe for both Browser and Node environments
    let pollInterval: ReturnType<typeof setInterval>;

    if (batchId && (batchStatus === "Pending" || batchStatus === "Processing")) {
      pollInterval = setInterval(async () => {
        try {
          const response = await axiosClient.get(`/api/transfers/bulk-upload/${batchId}/status`);
          setBatchStatus(response.data.status || response.data.Status);
          setBatchErrorMsg(response.data.message || response.data.Message || "");
          setHasErrorFile(response.data.hasErrorFile || response.data.HasErrorFile);

          if (response.data.status === "Completed" || response.data.status === "Failed") {
            clearInterval(pollInterval); // Stop asking, it's done!
          }
        } catch (error) {
          console.error("Error checking batch status", error);
        }
      }, 3000); // Ask every 3 seconds
    }

    return () => clearInterval(pollInterval); // Cleanup on unmount
  }, [batchId, batchStatus]);

  // 3. Handle File Upload
  const handleUpload = async (e: React.SubmitEvent) => {
    e.preventDefault();
    if (!file || !selectedAccount || !cutoffDate) return;

    setIsUploading(true);
    setBatchErrorMsg("");

    // Create a MultiPart Form payload for the file
    const formData = new FormData();
    formData.append("fromAccountNumber", selectedAccount);
    formData.append("file", file);
    formData.append("cuttOfDate", cutoffDate); // Must perfectly match C# parameter 'cuttOfDate'

    try {
      const response = await axiosClient.post("/api/transfers/bulk-upload", formData, {
        headers: { "Content-Type": "multipart/form-data" } // Tell Axios we are sending a file!
      });

      // C# returned 202 Accepted!
      setBatchId(response.data.batchId);
      setBatchStatus("Pending"); // Kick off the polling useEffect!
      
    } catch (error: any) {
      setBatchErrorMsg(error.response?.data || "Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // 4. Download Error File (Bulletproof Version)
  const handleDownloadErrors = async () => {
    if (!batchId) return;
    
    try {
      console.log(`[1] Requesting error file for Batch #${batchId}...`);
      
      const response = await axiosClient.get(`/api/transfers/bulk-upload/${batchId}/download-errors`, {
        responseType: 'blob' // Tell Axios we expect raw file data
      });
      
      console.log("[2] File received from C#! Triggering browser download...");
      
      // Create a temporary hidden link to force the browser download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payroll_Errors_Batch_${batchId}.csv`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup the DOM memory
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url); 
      
      console.log("[3] Download complete!");

    } catch (error: any) {
      console.error("DOWNLOAD CRASHED:", error);
      
      // Axios trap: If C# returned an error string, it gets trapped inside the Blob. We must extract it.
      if (error.response?.data instanceof Blob) {
        const textError = await error.response.data.text(); // Crack open the Blob
        
        // This will pop up on your screen with the EXACT message from your C# backend!
        alert(`C# Backend Error: ${textError}`); 
      } else {
        alert("Failed to download file. Please check the F12 Console.");
      }
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
          <Link to="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-brand-600 font-medium transition-colors">
            <LayoutDashboard className="w-5 h-5" /> Back to Dashboard
          </Link>
        </div>

        {/* UPLOAD FORM */}
        {!batchId ? (
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

              {batchErrorMsg && !batchId && (
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
        ) : (
          /* STATUS DASHBOARD (Visible while Processing or Completed) */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center animate-in fade-in">
            
            {batchStatus === "Pending" || batchStatus === "Processing" ? (
              <div className="py-12">
                <Loader2 className="w-16 h-16 animate-spin text-brand-600 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-slate-900">Processing Batch #{batchId}</h2>
                <p className="text-slate-500 mt-2">Hangfire is processing your Excel file securely in the background. You can leave this page; we'll keep working.</p>
                <div className="mt-8 inline-block bg-amber-50 text-amber-700 px-4 py-2 rounded-full font-bold uppercase tracking-widest text-sm border border-amber-100">
                  Status: {batchStatus}
                </div>
              </div>
            ) : batchStatus === "Completed" ? (
              <div className="py-12">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-slate-900">Batch Processing Completed!</h2>
                <p className="text-slate-500 mt-2">All valid transfers have been submitted to the ledger.</p>
                
                {hasErrorFile && (
                  <div className="mt-8 p-6 bg-rose-50 rounded-xl border border-rose-100 text-left">
                    <div className="flex items-start gap-4">
                      <AlertCircle className="w-6 h-6 text-rose-600 shrink-0 mt-1" />
                      <div>
                        <h4 className="font-bold text-rose-900 text-lg mb-1">Partial Failures Detected</h4>
                        <p className="text-rose-700 text-sm mb-4">Some rows in your Excel file were invalid (e.g., bad account numbers or insufficient funds). Download the error report to see exactly which rows failed.</p>
                        <button onClick={handleDownloadErrors} className="flex items-center gap-2 bg-white text-rose-700 border border-rose-200 px-4 py-2 rounded-lg font-bold hover:bg-rose-100 transition-colors shadow-sm">
                          <Download className="w-4 h-4" /> Download Error CSV
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                <button onClick={() => { setBatchId(null); setFile(null); }} className="mt-8 text-brand-600 font-medium hover:underline">
                  Upload another batch
                </button>
              </div>
            ) : batchStatus === "Failed" || batchStatus === "Error" ? (
              <div className="py-12 animate-in fade-in zoom-in duration-300">
                <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-slate-900">Batch Processing Failed</h2>
                <p className="text-slate-500 mt-2">Hangfire encountered errors while processing your file.</p>
                
                <div className="mt-8 inline-block bg-rose-50 text-rose-700 px-6 py-4 rounded-xl border border-rose-100 text-left max-w-lg mx-auto">
                  <span className="font-bold block mb-1">Server Error Message:</span>
                  <span className="font-mono text-sm">{batchErrorMsg || "Unknown error."}</span>
                </div>
                
                {/* --- ADD THIS NEW DOWNLOAD BLOCK --- */}
                {hasErrorFile && (
                  <div className="mt-8">
                    <button onClick={handleDownloadErrors} className="flex items-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-rose-700 transition-colors shadow-md mx-auto">
                      <Download className="w-5 h-5" /> Download Error CSV
                    </button>
                  </div>
                )}
           
                <div className="mt-8">
                  <button onClick={() => { setBatchId(null); setFile(null); }} className="text-brand-600 font-medium hover:underline">
                    Back to Upload Form
                  </button>
                </div>
              </div>
            ) : null}

          </div>
        )}

      </div>
    </div>
  );
}