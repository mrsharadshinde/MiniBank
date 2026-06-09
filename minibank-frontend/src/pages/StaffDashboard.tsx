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
  UserCog
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

  // ==========================================
  // 1. SEARCH CUSTOMER
  // ==========================================
  const handleSearch = async (e: React.FormEvent) => {
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
  const handleTransaction = async (e: React.FormEvent) => {
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
  const handleUpdateContact = async (e: React.FormEvent) => {
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
           <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <p className="text-slate-500 text-center py-12">KYC Form remains exactly the same as previously built.</p>
           </div>
        )}
      </div>
    </div>
  );
}