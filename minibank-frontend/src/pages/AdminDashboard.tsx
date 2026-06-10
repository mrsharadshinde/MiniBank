import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axiosClient from "../api/axiosClient";
import {
  ShieldCheck, LogOut, Loader2, CheckCircle, XCircle, Clock,
  ArrowRight, IndianRupee, AlertCircle, Users, Landmark, UserPlus, Archive, Settings, Search, ArrowLeft, Activity
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

// Added to support the Manage Accounts search feature
type Customer = {
  id?: string | number;
  ownerName?: string;
  email?: string;
  accountNumber?: string;
};

interface AuditLog {
  id: number;
  performedByUserId: number;
  performedByRole: string;
  targetUserId: number;
  action: string;
  oldValue: string;
  newValue: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const { logout, role } = useAuth();
  
  // --- UI STATE ---
  // Added "manage" to the active tabs
  const [activeTab, setActiveTab] = useState<"transfers" | "accounts" | "manage" | "staff" | "audit">("transfers");
  const [feedback, setFeedback] = useState({ message: "", isError: false });
  const [actionLoadingId, setActionLoadingId] = useState<string | number | null>(null);

  // --- TRANSFERS STATE ---
  const [pendingTransfers, setPendingTransfers] = useState<PendingTransfer[]>([]);
  const [isTransfersLoading, setIsTransfersLoading] = useState(true);

  // --- ACCOUNTS STATE (Pending Activations) ---
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>([]);
  const [isAccountsLoading, setIsAccountsLoading] = useState(true);

  // --- MANAGE ACCOUNTS STATE (Status Updates) ---
  const [searchAccNum, setSearchAccNum] = useState("");
  const [managedAccount, setManagedAccount] = useState<Customer | null>(null);
  const [manageForm, setManageForm] = useState({ newStatus: "Active", remarks: "" });
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isUpdateLoading, setIsUpdateLoading] = useState(false);

  // --- STAFF STATE ---
  const [staffProvisionStep, setStaffProvisionStep] = useState<1 | 2 | 3>(1);
  const [staffOtpForm, setStaffOtpForm] = useState({ email: "", mobileNumber: "" });
  const [staffOtpVerify, setStaffOtpVerify] = useState({ mobileOtp: "", emailOtp: "" });
  const [staffProvisioningToken, setStaffProvisioningToken] = useState("");
  const [staffForm, setStaffForm] = useState({ fullName: "", email: "", mobileNumber: "", aadharNumber: "", staffProvisioningToken: "" });
  const [isStaffLoading, setIsStaffLoading] = useState(false);

  // --- AUDIT LOG STATE ---
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditAvailableActions, setAuditAvailableActions] = useState<string[]>([]);

  // --- EFFECTS ---
  useEffect(() => {
    if (activeTab === "transfers") fetchPendingTransfers();
    if (activeTab === "accounts") fetchPendingAccounts();
    if (activeTab === "audit") {
      fetchAvailableActions();
      fetchAuditLogs(1);
    }
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
  // 2. ACCOUNTS LOGIC (Pending Activations)
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
      setFeedback({ message: response.data.message || response.data.Message || `Account ${newStatus}.`, isError: false });
      setPendingAccounts(prev => prev.filter(a => a.accountNumber !== accountNumber));
    } catch (error: any) {
      setFeedback({ message: error.response?.data || "Failed to update account status.", isError: true });
    } finally {
      setActionLoadingId(null);
    }
  };

  // ==========================================
  // 3. MANAGE ACCOUNTS (Suspend / Freeze / Update)
  // ==========================================
  const handleSearchForManage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSearchLoading(true);
    setFeedback({ message: "", isError: false });
    setManagedAccount(null);

    try {
      // Reusing the same endpoint the Teller uses to verify accounts
      const response = await axiosClient.get(`/api/accounts/${searchAccNum}`);
      setManagedAccount(response.data);
      setFeedback({ message: "Account found.", isError: false });
    } catch {
      setFeedback({ message: "Account not found. Ensure you are using the 12-digit number.", isError: true });
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleUpdateManagedStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const targetAccount = managedAccount?.accountNumber || searchAccNum;
    if (!targetAccount) return;

    setIsUpdateLoading(true);
    setFeedback({ message: "", isError: false });

    try {
      const response = await axiosClient.put(`/api/admin/accounts/${targetAccount}/status`, {
        newStatus: manageForm.newStatus,
        remarks: manageForm.remarks
      });
      
      setFeedback({ message: response.data.Message || response.data.message || `Status successfully updated to ${manageForm.newStatus}`, isError: false });
      
      // Reset form on success
      setManagedAccount(null);
      setSearchAccNum("");
      setManageForm({ newStatus: "Active", remarks: "" });
    } catch (error: any) {
      setFeedback({ message: error.response?.data || "Failed to update status.", isError: true });
    } finally {
      setIsUpdateLoading(false);
    }
  };

  // ==========================================
  // 4. PROVISION STAFF LOGIC (OTP-based)
  // ==========================================
  const handleSendStaffOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsStaffLoading(true);
    setFeedback({ message: "", isError: false });
    try {
      await axiosClient.post("/api/admin/staff/send-otp", {
        email: staffOtpForm.email,
        mobileNumber: staffOtpForm.mobileNumber
      });
      setFeedback({ message: "Verification codes sent to email and mobile.", isError: false });
      setStaffProvisionStep(2);
    } catch (error: any) {
      setFeedback({ message: error.response?.data?.Message || error.response?.data || "Failed to send OTPs.", isError: true });
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleVerifyStaffOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsStaffLoading(true);
    setFeedback({ message: "", isError: false });
    try {
      const response = await axiosClient.post("/api/admin/staff/verify-otp", {
        email: staffOtpForm.email,
        mobileNumber: staffOtpForm.mobileNumber,
        mobileOtp: staffOtpVerify.mobileOtp,
        emailOtp: staffOtpVerify.emailOtp
      });
      setStaffProvisioningToken(response.data.staffProvisioningToken);
      setStaffForm(prev => ({
        ...prev,
        email: staffOtpForm.email,
        mobileNumber: staffOtpForm.mobileNumber,
        staffProvisioningToken: response.data.staffProvisioningToken
      }));
      setFeedback({ message: "Contact verified successfully. Please enter staff details.", isError: false });
      setStaffProvisionStep(3);
    } catch (error: any) {
      setFeedback({ message: error.response?.data?.Message || error.response?.data || "Invalid verification codes.", isError: true });
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleProvisionStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsStaffLoading(true);
    setFeedback({ message: "", isError: false });
    try {
      const response = await axiosClient.post("/api/admin/provision-staff", {
        fullName: staffForm.fullName,
        email: staffForm.email,
        mobileNumber: staffForm.mobileNumber,
        aadharNumber: staffForm.aadharNumber,
        staffProvisioningToken: staffProvisioningToken
      });
      setFeedback({ message: response.data.message || "Teller provisioned successfully.", isError: false });
      // Reset to step 1
      setStaffProvisionStep(1);
      setStaffOtpForm({ email: "", mobileNumber: "" });
      setStaffOtpVerify({ mobileOtp: "", emailOtp: "" });
      setStaffForm({ fullName: "", email: "", mobileNumber: "", aadharNumber: "", staffProvisioningToken: "" });
      setStaffProvisioningToken("");
    } catch (error: any) {
      setFeedback({ message: error.response?.data?.Message || error.response?.data || "Failed to provision staff.", isError: true });
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleResetStaffProvisioning = () => {
    setStaffProvisionStep(1);
    setStaffOtpForm({ email: "", mobileNumber: "" });
    setStaffOtpVerify({ mobileOtp: "", emailOtp: "" });
    setStaffForm({ fullName: "", email: "", mobileNumber: "", aadharNumber: "", staffProvisioningToken: "" });
    setStaffProvisioningToken("");
    setFeedback({ message: "", isError: false });
  };

  // ==========================================
  // 5. AUDIT LOG LOGIC
  // ==========================================
  const fetchAvailableActions = async () => {
    try {
      const response = await axiosClient.get("/api/audit/actions");
      setAuditAvailableActions(response.data.actions || []);
    } catch (error) {
      console.error("Failed to load audit actions.");
    }
  };

  const fetchAuditLogs = async (page: number) => {
    setIsAuditLoading(true);
    try {
      const response = await axiosClient.get("/api/audit/logs", {
        params: {
          page,
          pageSize: 15,
          action: auditActionFilter || undefined
        }
      });
      setAuditLogs(response.data.data);
      setAuditTotalPages(response.data.pagination.totalPages);
      setAuditPage(page);
      setFeedback({ message: "", isError: false });
    } catch (error) {
      setFeedback({ message: "Failed to load audit logs.", isError: true });
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handleAuditFilterChange = async (newAction: string) => {
    setAuditActionFilter(newAction);
    setAuditPage(1);
    // Fetch with new filter
    setIsAuditLoading(true);
    try {
      const response = await axiosClient.get("/api/audit/logs", {
        params: {
          page: 1,
          pageSize: 15,
          action: newAction || undefined
        }
      });
      setAuditLogs(response.data.data);
      setAuditTotalPages(response.data.pagination.totalPages);
    } catch (error) {
      setFeedback({ message: "Failed to load audit logs.", isError: true });
    } finally {
      setIsAuditLoading(false);
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
        <div className="flex flex-wrap gap-4 mb-6">
          <button onClick={() => { setActiveTab("transfers"); setFeedback({message:"", isError:false}); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "transfers" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <Clock className="w-5 h-5" /> Pending Transfers
          </button>
          
          <button onClick={() => { setActiveTab("accounts"); setFeedback({message:"", isError:false}); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "accounts" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <Landmark className="w-5 h-5" /> Approvals
          </button>

          {/* NEW MANAGE ACCOUNTS TAB */}
          <button onClick={() => { setActiveTab("manage"); setFeedback({message:"", isError:false}); setManagedAccount(null); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "manage" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <Settings className="w-5 h-5" /> Manage Accounts
          </button>

          <button onClick={() => { setActiveTab("staff"); setFeedback({message:"", isError:false}); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "staff" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <UserPlus className="w-5 h-5" /> Provision Teller
          </button>
          <button onClick={() => { setActiveTab("audit"); setFeedback({message:"", isError:false}); }} className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "audit" ? "bg-slate-800 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            <Archive className="w-5 h-5" /> Audit Log
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
        {/* TAB 2: PENDING ACCOUNTS */}
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
        {/* TAB 3: MANAGE ACCOUNTS (Suspend/Freeze) */}
        {/* ========================================== */}
        {activeTab === "manage" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 animate-in fade-in">
             <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                 <Settings className="text-indigo-600" /> Account Status Management
             </h2>

             {!managedAccount ? (
                 <form onSubmit={handleSearchForManage} className="flex gap-4 max-w-lg">
                    <div className="flex-1 relative">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                       <input
                          type="text"
                          required
                          placeholder="Enter 12-Digit Account Number..."
                          value={searchAccNum}
                          onChange={(e) => setSearchAccNum(e.target.value)}
                          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <button type="submit" disabled={isSearchLoading} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-900 transition-colors">
                      {isSearchLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Find Account"}
                    </button>
                 </form>
             ) : (
                 <div className="max-w-lg space-y-6 animate-in slide-in-from-right-4">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                        <button onClick={() => { setManagedAccount(null); setFeedback({message:"", isError:false}); }} className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-2">
                           <ArrowLeft className="w-4 h-4" /> Back to Search
                        </button>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl">
                        <h3 className="text-lg font-bold text-slate-900">{managedAccount.ownerName}</h3>
                        <p className="text-slate-600 mb-2">{managedAccount.email}</p>
                        <span className="font-mono bg-white px-2 py-1 rounded shadow-sm border border-slate-200 text-sm tracking-widest text-slate-800">
                            ACC: {managedAccount.accountNumber || searchAccNum}
                        </span>
                    </div>

                    <form onSubmit={handleUpdateManagedStatus} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">New Account Status</label>
                            <select 
                                value={manageForm.newStatus} 
                                onChange={(e) => setManageForm({...manageForm, newStatus: e.target.value})}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 bg-white"
                            >
                                <option value="Active">Active</option>
                                <option value="Suspended">Suspended (Freeze)</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Audit Remarks (Optional)</label>
                            <input 
                                type="text" 
                                value={manageForm.remarks} 
                                onChange={(e) => setManageForm({...manageForm, remarks: e.target.value})}
                                placeholder="Reason for status change..." 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <button type="submit" disabled={isUpdateLoading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md mt-4">
                            {isUpdateLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Update Account Status"}
                        </button>
                    </form>
                 </div>
             )}
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 4: STAFF PROVISIONING */}
        {/* ========================================== */}
        {activeTab === "staff" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 animate-in fade-in">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Users className="text-indigo-600" /> Provision New Teller</h2>

            {/* Progress Tracker */}
            <div className="flex items-center justify-between mb-8 relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 -z-10 rounded-full transition-all duration-500" style={{ width: staffProvisionStep === 1 ? '0%' : staffProvisionStep === 2 ? '50%' : '100%' }}></div>

              {[1, 2, 3].map((step) => (
                <div key={step} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-colors ${staffProvisionStep >= step ? 'bg-indigo-600 border-indigo-100 text-white' : 'bg-slate-100 border-white text-slate-400'}`}>
                  {step}
                </div>
              ))}
            </div>

            <div className="max-w-lg mx-auto">
              {/* STEP 1: REQUEST OTP */}
              {staffProvisionStep === 1 && (
                <form onSubmit={handleSendStaffOtp} className="space-y-5 animate-in slide-in-from-right-4">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-900">Contact Verification</h3>
                    <p className="text-slate-500 text-sm">Step 1: Enter staff contact details to send verification codes.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={staffOtpForm.email}
                      onChange={e => setStaffOtpForm({...staffOtpForm, email: e.target.value})}
                      placeholder="staff@minibank.com"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={staffOtpForm.mobileNumber}
                      onChange={e => setStaffOtpForm({...staffOtpForm, mobileNumber: e.target.value})}
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button type="submit" disabled={isStaffLoading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md mt-4">
                    {isStaffLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Send Verification Codes"}
                  </button>
                </form>
              )}

              {/* STEP 2: VERIFY OTP */}
              {staffProvisionStep === 2 && (
                <form onSubmit={handleVerifyStaffOtp} className="space-y-5 animate-in slide-in-from-right-4">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-900">Enter Security Codes</h3>
                    <p className="text-slate-500 text-sm">Step 2: Enter the verification codes sent to email and mobile.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Mobile OTP</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={staffOtpVerify.mobileOtp}
                        onChange={e => setStaffOtpVerify({...staffOtpVerify, mobileOtp: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-center font-mono tracking-widest text-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Email OTP</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={staffOtpVerify.emailOtp}
                        onChange={e => setStaffOtpVerify({...staffOtpVerify, emailOtp: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-center font-mono tracking-widest text-lg"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setStaffProvisionStep(1)} className="px-6 py-4 rounded-xl font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">Back</button>
                    <button type="submit" disabled={isStaffLoading} className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md">
                      {isStaffLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Verify & Continue"}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: PROVISION STAFF */}
              {staffProvisionStep === 3 && (
                <form onSubmit={handleProvisionStaff} className="space-y-5 animate-in slide-in-from-right-4">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-900">Staff Details</h3>
                    <p className="text-slate-500 text-sm">Step 3: Contact verified. Complete staff profile.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Full Legal Name</label>
                    <input
                      type="text"
                      required
                      value={staffForm.fullName}
                      onChange={e => setStaffForm({...staffForm, fullName: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Government ID (12-Digit)</label>
                    <input
                      type="text"
                      required
                      maxLength={12}
                      value={staffForm.aadharNumber}
                      onChange={e => setStaffForm({...staffForm, aadharNumber: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest"
                    />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={handleResetStaffProvisioning} className="px-6 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
                    <button type="submit" disabled={isStaffLoading} className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md">
                      {isStaffLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Provision Teller"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 5: AUDIT LOG VIEWER */}
        {/* ========================================== */}
        {activeTab === "audit" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-bold text-slate-900">Audit Trail</h2>
              </div>
              <p className="text-sm text-slate-500 ml-auto">All admin and staff actions</p>
            </div>

            {/* Filter Section */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">Filter by Action</label>
              <select
                value={auditActionFilter}
                onChange={(e) => handleAuditFilterChange(e.target.value)}
                className="w-full md:w-64 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">All Actions</option>
                {auditAvailableActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            {/* Audit Logs Table */}
            {isAuditLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="text-center py-16 text-slate-500">No audit logs found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">ID</th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">Timestamp</th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">Action</th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">Performed By</th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">Target User</th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">Old Value</th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">New Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">#{log.id}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(log.timestamp).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">{log.performedByUserId}</span>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              log.performedByRole === 'Admin'
                                ? 'bg-slate-800 text-white'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {log.performedByRole}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          #{log.targetUserId}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="bg-rose-50 text-rose-700 px-2 py-1 rounded text-xs border border-rose-100 break-words">
                            {log.oldValue || '—'}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded text-xs border border-emerald-100 break-words">
                            {log.newValue || '—'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {auditTotalPages > 1 && (
              <div className="p-6 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  Page <strong>{auditPage}</strong> of <strong>{auditTotalPages}</strong>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchAuditLogs(auditPage - 1)}
                    disabled={auditPage === 1 || isAuditLoading}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors"
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => fetchAuditLogs(auditPage + 1)}
                    disabled={auditPage === auditTotalPages || isAuditLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}