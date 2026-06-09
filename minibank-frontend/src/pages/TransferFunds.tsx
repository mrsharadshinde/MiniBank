import { useState, useEffect } from "react";
import { Send, ArrowRight, IndianRupee, Loader2, AlertCircle, CheckCircle2, LayoutDashboard } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import axiosClient from "../api/axiosClient";

interface AccountData {
  accountNumber: string;
  balance: number;
  accountType: number;
}

export default function TransferFunds() {
  const navigate = useNavigate();

  // State
  const [myAccounts, setMyAccounts] = useState<AccountData[]>([]);
  const [formData, setFormData] = useState({
    fromAccount: "",
    toAccount: "",
    amount: ""
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(true);
  const [feedback, setFeedback] = useState({ message: "", type: "" }); // type: 'success' | 'error' | 'warning'

  // Load the user's accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const response = await axiosClient.get("/api/accounts/me");
        const activeAccounts = response.data.filter((a: any) => a.status === "Active");
        setMyAccounts(activeAccounts);
        
        // Auto-select the first account if it exists
        if (activeAccounts.length > 0) {
          setFormData(prev => ({ ...prev, fromAccount: activeAccounts[0].accountNumber }));
        }
      } catch (err) {
        setFeedback({ message: "Could not load your accounts. Please try again.", type: "error" });
      } finally {
        setIsFetchingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback({ message: "", type: "" });

    // Frontend Validations (Matching C# FluentValidation)
    if (formData.fromAccount === formData.toAccount) {
      setFeedback({ message: "You cannot transfer money to the same account.", type: "error" });
      setIsLoading(false);
      return;
    }
    if (!/^\d{12}$/.test(formData.toAccount)) {
      setFeedback({ message: "Receiver Account Number must be exactly 12 digits.", type: "error" });
      setIsLoading(false);
      return;
    }
    const amountNum = parseFloat(formData.amount);
    if (amountNum <= 0 || !/^\d+(\.\d{1,2})?$/.test(formData.amount)) {
      setFeedback({ message: "Amount must be greater than zero with max 2 decimal places.", type: "error" });
      setIsLoading(false);
      return;
    }

    // Generate Idempotency Key (Prevents double-charges if they click twice)
    const idempotencyKey = crypto.randomUUID();

    try {
      const response = await axiosClient.post("/api/transfers", {
        fromAccountNumber: formData.fromAccount,
        toAccountNumber: formData.toAccount,
        amount: amountNum
      }, {
        headers: {
          "X-Idempotency-Key": idempotencyKey
        }
      });

      // Handle 202 Accepted (Maker-Checker Interception) vs 200 OK
      if (response.status === 202) {
        setFeedback({ message: response.data.message || "High-value transfer requires Admin approval.", type: "warning" });
      } else {
        setFeedback({ message: "Transfer successful!", type: "success" });
      }
      
      // Clear the destination and amount
      setFormData(prev => ({ ...prev, toAccount: "", amount: "" }));

    } catch (error: any) {
      // Smart Error Parser
      let errorMsg = "Transfer failed. Please check your balance and try again.";
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') errorMsg = data;
        else if (data.errors) errorMsg = data.errors[Object.keys(data.errors)[0]][0];
        else if (data.detail) errorMsg = data.detail;
        else if (data.Message) errorMsg = data.Message;
      }
      setFeedback({ message: errorMsg, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Send className="text-brand-600 w-8 h-8" />
            Send Money
          </h1>
          <Link to="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-brand-600 font-medium transition-colors">
            <LayoutDashboard className="w-5 h-5" /> Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          {isFetchingAccounts ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
          ) : myAccounts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>You don't have any active accounts available for transfer.</p>
            </div>
          ) : (
            <form onSubmit={handleTransfer} className="space-y-6">
              
              {/* FROM ACCOUNT */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">From Account</label>
                <select 
                  required
                  value={formData.fromAccount}
                  onChange={(e) => setFormData({...formData, fromAccount: e.target.value})}
                  className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 bg-slate-50 text-slate-900 font-medium"
                >
                  {myAccounts.map(acc => (
                    <option key={acc.accountNumber} value={acc.accountNumber}>
                      {acc.accountType === 1 ? 'Checking' : acc.accountType === 2 ? 'Saving' : 'Account'} (...{acc.accountNumber.slice(-4)}) - Balance: ₹{acc.balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                    </option>
                  ))}
                </select>
              </div>

              {/* ARROW DIVIDER */}
              <div className="flex justify-center">
                <div className="bg-brand-50 p-2 rounded-full border border-brand-100">
                  <ArrowRight className="w-5 h-5 text-brand-600" />
                </div>
              </div>

              {/* TO ACCOUNT */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Recipient Account Number</label>
                <input 
                  type="text" 
                  required
                  maxLength={12}
                  placeholder="12-digit account number"
                  value={formData.toAccount}
                  onChange={(e) => setFormData({...formData, toAccount: e.target.value.replace(/\D/g, '')})} // Force numbers only!
                  className="w-full px-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 font-mono tracking-widest text-lg"
                />
              </div>

              {/* AMOUNT */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Amount (₹)</label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                  <input 
                    type="number" 
                    required
                    min="1"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500 text-2xl font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* FEEDBACK MESSAGES */}
              {feedback.message && (
                <div className={`p-4 rounded-xl text-sm font-medium flex items-start gap-3 
                  ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 
                    feedback.type === 'warning' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 
                    'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}
                >
                  {feedback.type === 'error' ? <AlertCircle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 shrink-0" />}
                  <p>{feedback.message}</p>
                </div>
              )}

              {/* SUBMIT */}
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-brand-600 text-white font-bold py-4 rounded-xl hover:bg-brand-700 transition-colors mt-4 text-lg shadow-md hover:shadow-lg disabled:bg-brand-400"
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Securely Send Money"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}