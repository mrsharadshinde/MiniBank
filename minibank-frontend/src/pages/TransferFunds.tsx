import { useState, useEffect } from "react";
import { Send, ArrowRight, Loader2, AlertCircle, CheckCircle2, IndianRupee } from "lucide-react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import axiosClient from "../api/axiosClient";

interface AccountData {
  accountNumber: string;
  balance: number;
  accountType: string;
}

export default function TransferMoney() {
  const [myAccounts, setMyAccounts] = useState<AccountData[]>([]);
  const [formData, setFormData] = useState({
    fromAccountNumber: "",
    toAccountNumber: "",
    amount: ""
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  // 1. Fetch available accounts on load
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await axiosClient.get("/api/accounts/me");
        // Only allow transfers from Active accounts
        const activeAccounts = response.data.filter((a: any) => a.status === "Active");
        setMyAccounts(activeAccounts);
        
        // Auto-select the first account if available
        if (activeAccounts.length > 0) {
          setFormData(prev => ({ ...prev, fromAccountNumber: activeAccounts[0].accountNumber }));
        }
      } catch (err) {
        setFeedback({ message: "Could not load your accounts. Check connection.", isError: true });
      }
    };
    fetchAccounts();
  }, []);

  // 2. Handle the Transfer Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback({ message: "", isError: false });

    // Validate amount locally before sending
    const transferAmount = Number(formData.amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      setFeedback({ message: "Please enter a valid amount greater than zero.", isError: true });
      setIsSubmitting(false);
      return;
    }

    try {
      // THE ENTERPRISE PATTERN: Generate a unique Idempotency Key
      const idempotencyKey = uuidv4();

      const response = await axiosClient.post(
        "/api/transfers", 
        {
          fromAccountNumber: formData.fromAccountNumber,
          toAccountNumber: formData.toAccountNumber,
          amount: transferAmount
        },
        {
          headers: {
            "X-Idempotency-Key": idempotencyKey
          }
        }
      );

      // Handle both standard 200 OK and 202 Accepted (Maker-Checker Trap)
      setFeedback({ 
        message: response.data.message || response.data.Message || "Transfer completed successfully.", 
        isError: false 
      });
      
      // Clear form on success, but keep the "from" account selected
      setFormData(prev => ({ ...prev, toAccountNumber: "", amount: "" }));

    } catch (error: any) {
      let errorMsg = "Failed to process transfer. Please try again.";
      if (error.response?.data) {
        if (typeof error.response.data === 'string') errorMsg = error.response.data;
        else if (error.response.data.Message) errorMsg = error.response.data.Message;
        else if (error.response.data.title) errorMsg = error.response.data.title; // Catch validation titles
      }
      setFeedback({ message: errorMsg, isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Send className="text-indigo-600 w-8 h-8" />
            Send Money
          </h1>
          <Link to="/dashboard" className="text-slate-500 hover:text-indigo-600 font-medium transition-colors">
            Cancel & Return
          </Link>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Sender Dropdown */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">From Account</label>
              <select 
                required
                value={formData.fromAccountNumber}
                onChange={(e) => setFormData({...formData, fromAccountNumber: e.target.value})}
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium appearance-none cursor-pointer"
              >
                {myAccounts.length === 0 && <option value="">Loading accounts...</option>}
                {myAccounts.map(acc => (
                  <option key={acc.accountNumber} value={acc.accountNumber}>
                     ...{acc.accountNumber.slice(-6)} 
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center py-2">
              <div className="bg-slate-100 p-3 rounded-full">
                <ArrowRight className="text-slate-400 w-5 h-5 rotate-90 md:rotate-0" />
              </div>
            </div>

            {/* Receiver Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Recipient Account Number</label>
              <input 
                type="text" 
                required
                placeholder="e.g. 100188811365"
                value={formData.toAccountNumber}
                onChange={(e) => setFormData({...formData, toAccountNumber: e.target.value.replace(/\D/g, '')})} // Numbers only
                className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest text-lg"
              />
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Amount (₹)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <IndianRupee className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                
                  type="number" 
                  required
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-bold text-xl text-slate-900"
                />
              </div>
            </div>

            {/* Feedback Alert */}
            {feedback.message && (
              <div className={`p-4 rounded-xl text-sm font-medium flex items-start gap-3 animate-in fade-in ${feedback.isError ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                {feedback.isError ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                <p>{feedback.message}</p>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={isSubmitting || myAccounts.length === 0}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Send Money Securely"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}