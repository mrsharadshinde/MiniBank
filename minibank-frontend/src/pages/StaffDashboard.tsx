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
  ArrowDownToLine,
  ArrowUpFromLine,
  IndianRupee,
  History,
  UserCog,
  CheckCircle
} from "lucide-react";
import axiosClient from "../api/axiosClient";
import TransactionHistory from "../components/TransactionHistory";

type KycStep = 1 | 2 | 3;

// Ensure your C# endpoint is updated to return 'id' (UserId) and 'accountNumber'!
type Customer = {
  id?: string | number;
  ownerName?: string;
  email?: string;
  accountNumber?: string; 
};

export default function StaffDashboard() {
  const { logout, role } = useAuth();

  const [activeTab, setActiveTab] = useState<"search" | "onboard">("search");
  const [searchIdentifier, setSearchIdentifier] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // --- UPGRADED: ACTION STATE ---
  const [activeAction, setActiveAction] = useState<"deposit" | "withdraw" | "ledger" | "contact" | null>(null);
  
  // Transaction State
  const [txAmount, setTxAmount] = useState<string>("");
  const [txDescription, setTxDescription] = useState<string>("");
  const [activeBalance, setActiveBalance] = useState<number | null>(null);

  // Contact Update State
  const [contactForm, setContactForm] = useState({ newEmail: "", newMobile: "" });

  const [onboardStep, setOnboardStep] = useState<KycStep>(1);
  const [formData, setFormData] = useState({
    ownerName: "", aadharNumber: "", mobileNumber: "", email: "", accountType: "Saving",
  });
  const [kycOtps, setKycOtps] = useState({ mobileOtp: "", emailOtp: "" });
  const [kycToken, setKycToken] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  // Success confirmation state
  const [successData, setSuccessData] = useState<any>(null);

  // ==========================================
  // 1. SEARCH CUSTOMER
  // ==========================================
  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback({ message: "", isError: false });
    setActiveBalance(null);
    setActiveAction(null);

    try {
      const response = await axiosClient.get(`/api/accounts/${searchIdentifier}`);
      setSelectedCustomer(response.data);
      setFeedback({ message: "Customer verified.", isError: false });
    } catch {
      setFeedback({ message: "User or Account not found.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 2. PROCESS DEPOSIT / WITHDRAW
  // ==========================================
  const handleTransaction = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeAction || !searchIdentifier) return;

    setIsLoading(true);
    setFeedback({ message: "", isError: false });

    const endpoint = activeAction === "deposit" ? "/api/teller/deposit" : "/api/teller/withdraw";
    
    try {
      const response = await axiosClient.post(endpoint, {
        accountNumber: searchIdentifier,
        amount: parseFloat(txAmount),
        description: txDescription
      });

      setFeedback({ 
        message: `${activeAction === "deposit" ? "Deposit" : "Withdrawal"} of ₹${txAmount} successful. Ref: ${response.data.transactionId || 'Success'}`, 
        isError: false 
      });
      setActiveBalance(response.data.newBalance); 
      setActiveAction(null);
      setTxAmount("");
      setTxDescription("");

    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.response?.data || "Transaction failed.";
      setFeedback({ message: typeof errorMsg === 'string' ? errorMsg : "Validation Error.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 3. UPDATE CONTACT INFO
  // ==========================================
  const handleUpdateContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCustomer?.id) {
      setFeedback({ message: "System Error: Missing User ID. Ensure C# returns 'Id' in search endpoint.", isError: true });
      return;
    }

    setIsLoading(true);
    setFeedback({ message: "", isError: false });

    try {
      const response = await axiosClient.put(`/api/accounts/users/${selectedCustomer.id}/contact`, contactForm);
      setFeedback({ message: response.data.message || "Contact details updated successfully.", isError: false });
      setContactForm({ newEmail: "", newMobile: "" });
      setActiveAction(null);
    } catch (error: any) {
      setFeedback({ message: error.response?.data || "Failed to update contact.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 4. KYC ONBOARDING FLOW
  // ==========================================
  const handleRequestKycOtp = async (e: React.FormEvent<HTMLFormElement>) => {
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

  const handleVerifyKycOtp = async (e: React.FormEvent<HTMLFormElement>) => {
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

  const handleFinalSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axiosClient.post("/api/accounts", {
        ...formData,
        kycToken,
      });

      setSuccessData(response.data);
    } catch (error: any) {
      let errorMsg = "Failed to create account. Please check inputs.";
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.errors) {
          const firstErrorKey = Object.keys(data.errors)[0];
          errorMsg = data.errors[firstErrorKey][0];
        } else if (data.detail) {
          errorMsg = data.detail;
        }
      }
      setFeedback({ message: errorMsg, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseSuccess = () => {
    setSuccessData(null);
    setOnboardStep(1);
    setFormData({ ownerName: "", aadharNumber: "", mobileNumber: "", email: "", accountType: "Saving" });
    setKycOtps({ mobileOtp: "", emailOtp: "" });
    setKycToken("");
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-3 rounded-xl">
              <Users className="text-emerald-600 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Staff Operations</h1>
              <p className="text-slate-500 text-sm">Authorized as: <span className="font-bold text-emerald-600 uppercase tracking-wider">{role}</span></p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-slate-500 hover:text-rose-500 font-medium">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>

        {/* Navigation */}
        {!selectedCustomer && (
          <div className="flex gap-4 mb-6">
            <button onClick={() => { setActiveTab("search"); setFeedback({ message: "", isError: false }); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 ${activeTab === "search" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200"}`}>
              <Search className="w-5 h-5" /> Teller CRM
            </button>
            <button onClick={() => { setActiveTab("onboard"); setFeedback({ message: "", isError: false }); setOnboardStep(1); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 ${activeTab === "onboard" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200"}`}>
              <UserPlus className="w-5 h-5" /> New KYC Onboarding
            </button>
          </div>
        )}

        {/* Global Feedback */}
        {feedback.message && (
          <div className={`p-4 rounded-xl text-sm font-medium animate-in fade-in ${feedback.isError ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}>
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
                <h2 className="text-lg font-bold text-slate-900 mb-4">Find Customer Account</h2>
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
                  <button type="submit" disabled={isLoading} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-900">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify Account"}
                  </button>
                </form>
                <p className="text-xs text-slate-500 mt-2 ml-2">Note: To process transactions or view ledgers, search by the 12-digit Account Number.</p>
              </>
            ) : (
              <div className="space-y-6">
                
                {/* CRM Header & Controls */}
                <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                    <button onClick={() => { setSelectedCustomer(null); setActiveAction(null); setActiveBalance(null); }} className="text-slate-500 flex items-center gap-2 hover:text-slate-800 text-sm font-medium">
                        <ArrowLeft className="w-4 h-4" /> Close CRM File
                    </button>
                    {activeBalance !== null && (
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                            <IndianRupee className="w-4 h-4" /> Current Balance: ₹{activeBalance.toLocaleString('en-IN', {minimumFractionDigits: 2})}
                        </div>
                    )}
                </div>

                {/* Customer Identity Card */}
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex items-center gap-4">
                  <div className="bg-emerald-600 p-4 rounded-full text-white">
                    <UserCheck className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedCustomer.ownerName || "Verified Account"}</h2>
                    <p className="text-slate-500">{selectedCustomer.email || "No email on file"}</p>
                    <p className="text-slate-800 font-mono tracking-widest mt-1 bg-white inline-block px-2 py-1 rounded shadow-sm border border-slate-200 text-sm">
                      ACC: {selectedCustomer.accountNumber || searchIdentifier}
                    </p>
                  </div>
                </div>

                {/* THE 4-BUTTON ACTION GRID */}
                {!activeAction ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                         <button onClick={() => setActiveAction("deposit")} className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-colors group">
                             <ArrowDownToLine className="w-8 h-8 text-emerald-500" />
                             <span className="font-bold text-slate-700 group-hover:text-emerald-700">Cash Deposit</span>
                         </button>
                         <button onClick={() => setActiveAction("withdraw")} className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-slate-100 hover:border-rose-500 hover:bg-rose-50 transition-colors group">
                             <ArrowUpFromLine className="w-8 h-8 text-rose-500" />
                             <span className="font-bold text-slate-700 group-hover:text-rose-700">Cash Withdraw</span>
                         </button>
                         <button onClick={() => setActiveAction("ledger")} className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 transition-colors group">
                             <History className="w-8 h-8 text-indigo-500" />
                             <span className="font-bold text-slate-700 group-hover:text-indigo-700">View Ledger</span>
                         </button>
                         <button onClick={() => setActiveAction("contact")} className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-slate-100 hover:border-amber-500 hover:bg-amber-50 transition-colors group">
                             <UserCog className="w-8 h-8 text-amber-500" />
                             <span className="font-bold text-slate-700 group-hover:text-amber-700">Update Contact</span>
                         </button>
                     </div>
                ) : (
                    <div className="animate-in slide-in-from-bottom-4 pt-2">
                        
                        {/* BACK BUTTON */}
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                {activeAction === 'deposit' && <><ArrowDownToLine className="text-emerald-600"/> Cash Deposit</>}
                                {activeAction === 'withdraw' && <><ArrowUpFromLine className="text-rose-600"/> Cash Withdrawal</>}
                                {activeAction === 'contact' && <><UserCog className="text-amber-600"/> Update Contact Info</>}
                                {activeAction === 'ledger' && <><History className="text-indigo-600"/> Financial Ledger</>}
                            </h3>
                            <button onClick={() => setActiveAction(null)} className="text-sm text-slate-500 hover:text-slate-800 font-medium">Cancel Action</button>
                        </div>

                        {/* ACTION 1 & 2: DEPOSIT OR WITHDRAW */}
                        {(activeAction === "deposit" || activeAction === "withdraw") && (
                          <div className="border border-slate-200 rounded-2xl p-6 bg-white">
                            <form onSubmit={handleTransaction} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹)</label>
                                    <div className="relative">
                                        <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
                                        <input type="number" min="1" step="0.01" required value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="0.00" className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 text-2xl font-bold" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Narration (Optional)</label>
                                    <input type="text" value={txDescription} onChange={(e) => setTxDescription(e.target.value)} placeholder="Enter details..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" />
                                </div>
                                <button type="submit" disabled={isLoading} className={`w-full py-4 rounded-xl font-bold text-white text-lg mt-4 transition-colors ${activeAction === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : `Confirm ${activeAction === 'deposit' ? 'Deposit' : 'Withdrawal'}`}
                                </button>
                            </form>
                          </div>
                        )}

                        {/* ACTION 3: UPDATE CONTACT */}
                        {activeAction === "contact" && (
                          <div className="border border-slate-200 rounded-2xl p-6 bg-white">
                            <form onSubmit={handleUpdateContact} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">New Email Address</label>
                                    <input type="email" value={contactForm.newEmail} onChange={(e) => setContactForm({...contactForm, newEmail: e.target.value})} placeholder={selectedCustomer.email} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">New Mobile Number</label>
                                    <input type="tel" value={contactForm.newMobile} onChange={(e) => setContactForm({...contactForm, newMobile: e.target.value})} placeholder="Enter new mobile..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500" />
                                </div>
                                <button type="submit" disabled={isLoading || (!contactForm.newEmail && !contactForm.newMobile)} className="w-full py-4 rounded-xl font-bold text-white text-lg mt-4 bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50">
                                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Save New Contact Details"}
                                </button>
                            </form>
                          </div>
                        )}

                        {/* ACTION 4: VIEW LEDGER */}
                        {activeAction === "ledger" && (
                          <TransactionHistory accountNumber={selectedCustomer.accountNumber || searchIdentifier} />
                        )}

                    </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================== */}
        {/* TAB 2: KYC ONBOARDING */}
        {/* ============================== */}
        {activeTab === "onboard" && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 animate-in fade-in">

            {/* SUCCESS CONFIRMATION SCREEN */}
            {successData ? (
              <div className="max-w-lg mx-auto text-center space-y-6 py-12">
                <div className="flex justify-center mb-6">
                  <div className="bg-emerald-100 p-6 rounded-full">
                    <CheckCircle className="w-16 h-16 text-emerald-600" />
                  </div>
                </div>

                <div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-2">Account Created Successfully!</h2>
                  <p className="text-slate-600">The customer account has been provisioned and is ready to use.</p>
                </div>

                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 space-y-4 text-left">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer Name</p>
                    <p className="text-xl font-bold text-slate-900">{successData.ownerName || "N/A"}</p>
                  </div>

                  <div className="border-t border-emerald-100 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Number</p>
                    <p className="text-2xl font-mono font-bold text-emerald-700 bg-white px-4 py-2 rounded-lg border border-emerald-200 text-center tracking-widest">
                      {successData.accountNumber || successData.AccountNumber || "Generating..."}
                    </p>
                  </div>

                  <div className="border-t border-emerald-100 pt-4 grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Type</p>
                      <p className="text-lg font-bold text-slate-800">{successData.accountType || successData.AccountType || "Standard"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</p>
                      <p className="text-lg font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg inline-block">
                        {successData.status || successData.Status || "Pending"}
                      </p>
                    </div>
                  </div>

                  {successData.email && (
                    <div className="border-t border-emerald-100 pt-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</p>
                      <p className="text-sm text-slate-700">{successData.email}</p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left">
                  <p className="text-sm text-blue-800"><strong>Next Steps:</strong> The customer can now use their account number to perform transactions. An email confirmation has been sent to their registered email address.</p>
                </div>

                <button
                  onClick={handleCloseSuccess}
                  className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-colors shadow-md"
                >
                  Close & Return to Onboarding
                </button>
              </div>
            ) : (
              <>

            {/* Progress Tracker */}
            <div className="flex items-center justify-between mb-8 relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 -z-10 rounded-full transition-all duration-500" style={{ width: onboardStep === 1 ? '0%' : onboardStep === 2 ? '50%' : '100%' }}></div>

              {[1, 2, 3].map((step) => (
                <div key={step} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 ${onboardStep >= step ? 'bg-emerald-600 border-emerald-100 text-white' : 'bg-slate-100 border-white text-slate-400'}`}>
                  {step}
                </div>
              ))}
            </div>

            <div className="max-w-lg mx-auto">
              
              {/* STEP 1: REQUEST OTP */}
              {onboardStep === 1 && (
                <form onSubmit={handleRequestKycOtp} className="space-y-5 animate-in slide-in-from-right-4">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Contact Verification</h2>
                    <p className="text-slate-500 text-sm">Step 1: Enter customer details to send secure OTPs.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mobile Number</label>
                    <input type="tel" required value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} placeholder="e.g. 9876543210" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="customer@example.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl hover:bg-slate-900 transition-colors shadow-md mt-4">
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Send Verification Codes"}
                  </button>
                </form>
              )}

              {/* STEP 2: VERIFY OTP */}
              {onboardStep === 2 && (
                <form onSubmit={handleVerifyKycOtp} className="space-y-5 animate-in slide-in-from-right-4">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Enter Security Codes</h2>
                    <p className="text-slate-500 text-sm">Step 2: Ask the customer for the codes sent to their devices.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Mobile OTP</label>
                      <input type="text" required maxLength={6} value={kycOtps.mobileOtp} onChange={e => setKycOtps({...kycOtps, mobileOtp: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 text-center font-mono tracking-widest text-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Email OTP</label>
                      <input type="text" required maxLength={6} value={kycOtps.emailOtp} onChange={e => setKycOtps({...kycOtps, emailOtp: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 text-center font-mono tracking-widest text-lg" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setOnboardStep(1)} className="px-6 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Back</button>
                    <button type="submit" disabled={isLoading} className="flex-1 bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-colors shadow-md">
                      {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Verify Identity"}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: ACCOUNT CREATION */}
              {onboardStep === 3 && (
                <form onSubmit={handleFinalSubmit} className="space-y-5 animate-in slide-in-from-right-4">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Finalize KYC Profile</h2>
                    <p className="text-slate-500 text-sm">Step 3: Identity verified. Complete the core banking profile.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Full Legal Name</label>
                    <input type="text" required value={formData.ownerName} onChange={e => setFormData({...formData, ownerName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Government ID (12-Digit)</label>
                    <input type="text" required maxLength={12} value={formData.aadharNumber} onChange={e => setFormData({...formData, aadharNumber: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 font-mono tracking-widest" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Account Product Type</label>
                    <select value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 bg-white">
                      <option value="Checking">Checking</option>
                      <option value="Saving">Saving</option>
                      <option value="Business">Business</option>
                      <option value="Student">Student</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl hover:bg-emerald-700 transition-colors shadow-md mt-4">
                    {isLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Provision Bank Account"}
                  </button>
                </form>
              )}

            </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}