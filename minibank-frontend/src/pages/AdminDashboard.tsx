import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axiosClient from "../api/axiosClient";
import { 
  ShieldCheck, LogOut, Loader2, CheckCircle, XCircle, Clock, 
  ArrowRight, IndianRupee, AlertCircle, Users, Landmark, UserPlus 
} from "lucide-react";

// --- INTERFACES ---
interface PendingTransfer {
  id: number;
  makerName: string;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  remark: string;
  createdAt: string;
}

interface PendingAccount {
  accountNumber: string;
  accountType: string;
  createdAt: string;
  ownerName: string;
  email: string;
}

export default function AdminDashboard() {
  const { logout, role } = useAuth();
  
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState<"transfers" | "accounts" | "staff">("transfers");
  const [feedback, setFeedback] = useState({ message: "", isError: false });
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // --- TRANSFERS STATE ---
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [isTransfersLoading, setIsTransfersLoading] = useState(true);

  // --- ACCOUNTS STATE ---
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);

  // --- STAFF STATE ---
  const [staffForm, setStaffForm] = useState({ fullName: "", email: "", mobileNumber: "", aadharNumber: "" });
  const [isStaffLoading, setIsStaffLoading] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    if (activeTab === "transfers") fetchPendingTransfers();
    if (activeTab === "accounts") fetchPendingAccounts();
  }, [activeTab]);

  // ==========================================
  // 1. TRANSFERS LOGIC (Maker-Checker)
  // ==========================================
  const fetchPendingTransfers = async () => {
    setIsTransfersLoading(true);
    try {
      const response = await axiosClient.get("/api/approvals/pending");
      setPendingTransfers(response.data);
    } catch (error) {
      setFeedback({ message: "Failed to load pending transfers.", isError: true });
    } finally {
      setIsTransfersLoading(false);
    }
  };

  const handleResolveTransfer = async (approvalId: number, isApproved: boolean) => {
    setActionLoadingId(approvalId);
    setFeedback({ message: "", isError: false });
    try {
      const response = await axiosClient.post(`/api/approvals/${approvalId}/resolve`, {
        isApproved,
        remark: isApproved ? "Approved by CTO" : "Rejected by CTO"
      });
      setFeedback({ message: response.data.message || `Transfer ${isApproved ? 'approved' : 'rejected'}.`, isError: false });
      setPendingTransfers(prev => prev.filter(t => t.id !== approvalId));
    } catch (error: any) {
      setFeedback({ message: error.response?.data?.Message || error.response?.data || "Failed to resolve transfer.", isError: true });
    } finally {
      setActionLoadingId(null);
    }
  };

  // ==========================================
  // 2. ACCOUNTS LOGIC (Activation)
  // ==========================================
  const fetchPendingAccounts = async () => {
    setIsAccountsLoading(true);
    try {
      const response = await axiosClient.get("/api/admin/accounts/pending");
      setPendingAccounts(response.data);
    } catch (error) {
      setFeedback({ message: "Failed to load pending accounts.", isError: true });
    } finally {
      setIsAccountsLoading(false);
    }
  };

  const handleAccountStatus = async (accountNumber: string, newStatus: "Active" | "Rejected") => {
    setActionLoadingId(accountNumber);
    setFeedback({ message: "", isError: false });
    try {
      const response = await axiosClient.put(`/api/admin/accounts/${accountNumber}/status`, {
        newStatus,
        remarks: newStatus === "Active" ? "Account verified and activated by Admin." : "Account rejected due to compliance."
      });
      setFeedback({ message: response.data.message || `Account ${newStatus}.`, isError: false });
      setPendingAccounts(prev => prev.filter(a => a.accountNumber !== accountNumber));
    } catch (error: any) {
      setFeedback({ message: error.response?.data || "Failed to update account status.", isError: true });
    } finally {
      setActionLoadingId(null);
    }
  };

  // ==========================================
  // 3. PROVISION STAFF LOGIC
  // ==========================================
  const handleProvisionStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsStaffLoading(true);
    setFeedback({ message: "", isError: false });
    try {
      const response = await axiosClient.post("/api/admin/provision-staff", staffForm);
      setFeedback({ message: response.data.message || "Teller provisioned successfully.", isError: false });
      setStaffForm({ fullName: "", email: "", mobileNumber: "", aadharNumber: "" });
    } catch (error: any) {
      setFeedback({ message: error.response?.data || "Failed to provision staff.", isError: true });
    } finally {
      setIsStaffLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Panel */}
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-3 rounded-xl">
              <ShieldCheck className="text-indigo-600 w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Admin Control Center</h1>
              <p className="text-slate-500 text-sm">Authorized as: <span className="font-bold text-indigo-600 uppercase tracking-wider">{role}</span></p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-slate-500 hover:text-rose-500 font-medium transition-colors">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6">
          <button onClick={() => { setActiveTab("transfers"); setFeedback({message:"", isError:false}); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "transfers" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <Clock className="w-5 h-5" /> Pending Transfers
          </button>
          <button onClick={() => { setActiveTab("accounts"); setFeedback({message:"", isError:false}); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "accounts" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <Landmark className="w-5 h-5" /> Account Approvals
          </button>
          <button onClick={() => { setActiveTab("staff"); setFeedback({message:"", isError:false}); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "staff" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <UserPlus className="w-5 h-5" /> Provision Teller
          </button>
        </div>

        {/* Global Feedback Alert */}
        {feedback.message && (
          <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in ${feedback.isError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
            {feedback.isError && <AlertCircle className="w-5 h-5 shrink-0" />}
            {feedback.message}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 1: TRANSFERS */}
        {/* ========================================== */}
        {activeTab === "transfers" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Maker-Checker Approvals</h2>
              <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-bold">{pendingTransfers.length} Pending</span>
            </div>
            {isTransfersLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
            ) : pendingTransfers.length === 0 ? (
              <p className="text-center py-16 text-slate-500">No pending transfers require approval.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingTransfers.map((transfer) => (
                  <li key={transfer.id} className="p-6 hover:bg-slate-50/50 flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex-1 space-y-3">
                      <div className="text-sm text-slate-500 font-medium">ID: #{transfer.id} • Req by: <strong className="text-slate-700">{transfer.makerName}</strong></div>
                      <div className="flex gap-4">
                        <div className="bg-white border p-3 rounded-xl shadow-sm"><p className="text-xs text-slate-400">SENDER ID</p><p className="font-mono">{transfer.fromAccountId}</p></div>
                        <ArrowRight className="text-slate-300 mt-5" />
                        <div className="bg-white border p-3 rounded-xl shadow-sm"><p className="text-xs text-slate-400">RECEIVER ID</p><p className="font-mono">{transfer.toAccountId}</p></div>
                      </div>
                      <p className="text-sm bg-amber-50 text-amber-700 p-2 rounded-lg inline-block border border-amber-100"><strong>Flag:</strong> {transfer.remark}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-4">
                      <p className="text-3xl font-bold text-slate-900 flex items-center"><IndianRupee className="w-6 h-6 text-slate-400" />{transfer.amount.toLocaleString()}</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleResolveTransfer(transfer.id, false)} disabled={actionLoadingId === transfer.id} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 flex items-center gap-1"><XCircle className="w-4 h-4"/> Reject</button>
                        <button onClick={() => handleResolveTransfer(transfer.id, true)} disabled={actionLoadingId === transfer.id} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1">{actionLoadingId === transfer.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <><CheckCircle className="w-4 h-4"/> Approve</>}</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 2: ACCOUNTS */}
        {/* ========================================== */}
        {activeTab === "accounts" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Pending Account Activations</h2>
              <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-bold">{pendingAccounts.length} Pending</span>
            </div>
            {isAccountsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
            ) : pendingAccounts.length === 0 ? (
              <p className="text-center py-16 text-slate-500">No accounts are pending activation.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingAccounts.map((acc) => (
                  <li key={acc.accountNumber} className="p-6 hover:bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-slate-900">{acc.ownerName}</h4>
                      <p className="text-slate-500 text-sm">{acc.email}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm tracking-widest">{acc.accountNumber}</span>
                        <span className="bg-brand-50 text-brand-700 border border-brand-100 px-2 py-1 rounded text-xs font-bold uppercase">{acc.accountType}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAccountStatus(acc.accountNumber, "Rejected")} disabled={actionLoadingId === acc.accountNumber} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 flex items-center gap-1"><XCircle className="w-4 h-4"/> Reject</button>
                      <button onClick={() => handleAccountStatus(acc.accountNumber, "Active")} disabled={actionLoadingId === acc.accountNumber} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-1">{actionLoadingId === acc.accountNumber ? <Loader2 className="w-4 h-4 animate-spin"/> : <><CheckCircle className="w-4 h-4"/> Activate</>}</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 3: STAFF PROVISIONING */}
        {/* ========================================== */}
        {activeTab === "staff" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 animate-in fade-in">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Users className="text-indigo-600" /> Create New Teller Profile</h2>
            <form onSubmit={handleProvisionStaff} className="space-y-5 max-w-lg">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Full Legal Name</label>
                <input type="text" required value={staffForm.fullName} onChange={e => setStaffForm({...staffForm, fullName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Corporate Email Address</label>
                <input type="email" required value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Mobile Number</label>
                <input type="tel" required value={staffForm.mobileNumber} onChange={e => setStaffForm({...staffForm, mobileNumber: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Government ID (12-Digit)</label>
                <input type="text" required maxLength={12} value={staffForm.aadharNumber} onChange={e => setStaffForm({...staffForm, aadharNumber: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest" />
              </div>
              <button type="submit" disabled={isStaffLoading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md mt-4">
                {isStaffLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Provision Teller & Send Credentials"}
              </button>
            </form>
          </section>
        )}

      </div>
    </div>
  );
}