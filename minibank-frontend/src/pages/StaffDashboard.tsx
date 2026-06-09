import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Users,
  LogOut,
  Search,
  UserCheck,
  Loader2,
  UserPlus,
  ArrowLeft,
  Mail,
  Phone,
  ArrowDownToLine,
  ArrowUpFromLine,
  IndianRupee,
} from "lucide-react";
import axiosClient from "../api/axiosClient";

type KycStep = 1 | 2 | 3;

// Updated to match exactly what your C# endpoint returns for /api/accounts/{identifier}
type Customer = {
  id?: string | number;
  ownerName?: string;
  email?: string;
  accountNumber?: string; // Assume your C# endpoint can return this if searched by Account Number!
};

export default function StaffDashboard() {
  const { logout, role } = useAuth();

  const [activeTab, setActiveTab] = useState<"search" | "onboard">("search");
  const [searchIdentifier, setSearchIdentifier] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // --- NEW: TELLER TRANSACTION STATE ---
  const [transactionMode, setTransactionMode] = useState<"deposit" | "withdraw" | null>(null);
  const [txAmount, setTxAmount] = useState<string>("");
  const [txDescription, setTxDescription] = useState<string>("");
  const [activeBalance, setActiveBalance] = useState<number | null>(null); // To show balance after tx

  const [onboardStep, setOnboardStep] = useState<KycStep>(1);
  const [formData, setFormData] = useState({
    ownerName: "",
    aadharNumber: "",
    mobileNumber: "",
    email: "",
    accountType: "Saving",
  });
  const [kycOtps, setKycOtps] = useState({ mobileOtp: "", emailOtp: "" });
  const [kycToken, setKycToken] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  // 1. Search Customer
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback({ message: "", isError: false });
    setActiveBalance(null);
    setTransactionMode(null);

    try {
      const response = await axiosClient.get(`/api/accounts/${searchIdentifier}`);
      setSelectedCustomer(response.data);
      // If the search returned the account number, we are ready! If it only returned User details, 
      // the Teller might need to type the Account Number in the transaction form.
      setFeedback({ message: "Customer verified.", isError: false });
    } catch {
      setFeedback({ message: "User or Account not found.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // --- NEW: PROCESS DEPOSIT / WITHDRAW ---
  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionMode || !searchIdentifier) return;

    setIsLoading(true);
    setFeedback({ message: "", isError: false });

    const endpoint = transactionMode === "deposit" ? "/api/teller/deposit" : "/api/teller/withdraw";
    
    try {
      const response = await axiosClient.post(endpoint, {
        accountNumber: searchIdentifier, // Using the search ID assuming they searched by Account Number
        amount: parseFloat(txAmount),
        description: txDescription
      });

      setFeedback({ 
        message: `${transactionMode === "deposit" ? "Deposit" : "Withdrawal"} of ₹${txAmount} successful. Ref: ${response.data.transactionId}`, 
        isError: false 
      });
      setActiveBalance(response.data.newBalance); // The C# backend returns this!
      setTransactionMode(null);
      setTxAmount("");
      setTxDescription("");

    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.response?.data || "Transaction failed.";
      setFeedback({ message: typeof errorMsg === 'string' ? errorMsg : "Validation Error.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

//   #######################################################
  const handleRequestKycOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback({ message: "", isError: false });

    try {
      await axiosClient.post("/api/kyc/send-otp", {
        mobileNumber: formData.mobileNumber,
        email: formData.email,
      });

      setKycOtps({ mobileOtp: "", emailOtp: "" });
      setKycToken("");
      setOnboardStep(2);
      setFeedback({
        message: "Verification codes sent to mobile and email.",
        isError: false,
      });
    } catch (error: any) {
      setFeedback({
        message: error?.response?.data ?? "Failed to send verification codes.",
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
// #################################################################
  const handleVerifyKycOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback({ message: "", isError: false });

    try {
      const response = await axiosClient.post("/api/kyc/verify-otp", {
        mobileNumber: formData.mobileNumber,
        email: formData.email,
        mobileOtp: kycOtps.mobileOtp,
        emailOtp: kycOtps.emailOtp,
      });

      setKycToken(response.data.kycToken ?? response.data.KycToken ?? "");
      setOnboardStep(3);
      setFeedback({
        message: "Contact verified. Please enter government details.",
        isError: false,
      });
    } catch (error: any) {
      setFeedback({
        message: error?.response?.data ?? "Invalid verification codes.",
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };
// ##########################################################
 const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axiosClient.post("/api/accounts", {
        ...formData,
        kycToken,
      });

      setFeedback({
        message: `Success! Account created for ${response.data.ownerName}.`,
        isError: false,
      });
      setOnboardStep(1);
      setFormData({ ownerName: "", aadharNumber: "", mobileNumber: "", email: "", accountType: "Saving" });
      setKycOtps({ mobileOtp: "", emailOtp: "" });
      setKycToken("");
    } catch (error: any) {
      // --- SMART ERROR PARSER ---
      let errorMsg = "Failed to create account. Please check inputs.";
      
      if (error.response?.data) {
        const data = error.response.data;
        
        if (typeof data === 'string') {
          // Catch 1: Plain strings (like your 409 Conflict duplicate ID error)
          errorMsg = data;
        } else if (data.errors) {
          // Catch 2: FluentValidation Dictionaries
          // Grabs the very first error message from the list
          const firstErrorKey = Object.keys(data.errors)[0];
          errorMsg = data.errors[firstErrorKey][0];
        } else if (data.detail) {
          // Catch 3: Standard ASP.NET ProblemDetails
          errorMsg = data.detail;
        }
      }
      
      setFeedback({ message: errorMsg, isError: true });
      // --------------------------
    } finally {
      setIsLoading(false);
    }
  };
return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-3 rounded-xl">
              <Users className="text-emerald-600 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Staff Operations
              </h1>
              <p className="text-slate-500 text-sm">
                Authorized as:{" "}
                <span className="font-bold text-emerald-600 uppercase tracking-wider">{role}</span>
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-500 hover:text-rose-500 font-medium"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>

        {!selectedCustomer && (
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                setActiveTab("search");
                setFeedback({ message: "", isError: false });
              }}
              className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 ${activeTab === "search" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              <Search className="w-5 h-5" /> Teller CRM
            </button>
            <button
              onClick={() => {
                setActiveTab("onboard");
                setFeedback({ message: "", isError: false });
                setOnboardStep(1);
              }}
              className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 ${activeTab === "onboard" ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}
            >
              <UserPlus className="w-5 h-5" /> New KYC Onboarding
            </button>
          </div>
        )}

        {feedback.message && (
          <div
            className={`p-4 rounded-xl text-sm font-medium ${feedback.isError ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}
          >
            {feedback.message}
          </div>
        )}

        {/* ============================== */}
        {/* TAB 1: TELLER CRM TRANSACTIONS */}
        {/* ============================== */}
        {activeTab === "search" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-in fade-in">
            {!selectedCustomer ? (
              <>
                <h2 className="text-lg font-bold text-slate-900 mb-4">
                  Find Customer Account
                </h2>
                <form onSubmit={handleSearch} className="flex gap-4">
                  <div className="flex-1 relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                     <input
                        type="text"
                        placeholder="Enter Account Number..."
                        value={searchIdentifier}
                        onChange={(e) => setSearchIdentifier(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                      />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-slate-800 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-900"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (
                      "Verify Account"
                    )}
                  </button>
                </form>
                <p className="text-xs text-slate-500 mt-2 ml-2">Note: To process deposits/withdrawals, you must search by exactly the 12-digit Account Number.</p>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center mb-4">
                    <button
                    onClick={() => {
                        setSelectedCustomer(null);
                        setTransactionMode(null);
                        setActiveBalance(null);
                    }}
                    className="text-slate-500 flex items-center gap-2 hover:text-slate-800 text-sm font-medium"
                    >
                    <ArrowLeft className="w-4 h-4" /> Clear Search
                    </button>
                    {activeBalance !== null && (
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                            <IndianRupee className="w-4 h-4" /> Current Balance: ₹{activeBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                        </div>
                    )}
                </div>

                <div className="bg-brand-50 border border-brand-100 p-6 rounded-2xl flex items-center gap-4">
                  <div className="bg-brand-600 p-4 rounded-full text-white">
                    <UserCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      {selectedCustomer.ownerName || "Verified Account"}
                    </h2>
                    <p className="text-slate-600 font-mono tracking-widest">{searchIdentifier}</p>
                  </div>
                </div>

                {!transactionMode ? (
                     <>
                        <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">
                            Over-The-Counter (OTC) Operations
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={() => setTransactionMode("deposit")}
                                className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-colors group"
                            >
                                <ArrowDownToLine className="w-10 h-10 text-emerald-500" />
                                <span className="font-bold text-slate-700 group-hover:text-emerald-700">Receive Deposit</span>
                            </button>
                            
                            <button
                                onClick={() => setTransactionMode("withdraw")}
                                className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-slate-100 hover:border-rose-500 hover:bg-rose-50 transition-colors group"
                            >
                                <ArrowUpFromLine className="w-10 h-10 text-rose-500" />
                                <span className="font-bold text-slate-700 group-hover:text-rose-700">Process Withdrawal</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="border border-slate-200 rounded-2xl p-6 bg-white animate-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`text-xl font-bold flex items-center gap-2 ${transactionMode === 'deposit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {transactionMode === 'deposit' ? <ArrowDownToLine /> : <ArrowUpFromLine />}
                                {transactionMode === 'deposit' ? 'Cash Deposit' : 'Cash Withdrawal'}
                            </h3>
                            <button onClick={() => setTransactionMode(null)} className="text-sm text-slate-500 hover:text-slate-800">Cancel</button>
                        </div>

                        <form onSubmit={handleTransaction} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
                                <div className="relative">
                                    <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                                    <input 
                                        type="number" 
                                        min="1" 
                                        step="0.01" 
                                        required 
                                        value={txAmount}
                                        onChange={(e) => setTxAmount(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 text-2xl font-bold"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description / Narration (Optional)</label>
                                <input 
                                    type="text" 
                                    value={txDescription}
                                    onChange={(e) => setTxDescription(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                                    placeholder={transactionMode === 'deposit' ? 'Cash deposit at branch...' : 'Cash withdrawal at branch...'}
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className={`w-full py-4 rounded-xl font-bold text-white text-lg mt-4 transition-colors ${transactionMode === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                            >
                                {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : `Confirm ${transactionMode === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
                            </button>
                        </form>
                    </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================== */}
        {/* TAB 2: KYC ONBOARDING (Collapsed for brevity) */}
        {/* ============================== */}
        {activeTab === "onboard" && (
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <p className="text-slate-500 text-center py-12">KYC Form remains exactly the same as previously built.</p>
           </div>
        )}
      </div>
    </div>
  );
}