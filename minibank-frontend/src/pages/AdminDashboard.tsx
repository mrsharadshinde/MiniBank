// AdminDashboard.tsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import axiosClient from "../api/axiosClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // 🔥 Import TanStack Query
import {
  ShieldCheck,
  LogOut,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  IndianRupee,
  AlertCircle,
  Users,
  Landmark,
  UserPlus,
  Archive,
  Settings,
  Search,
  ArrowLeft,
  Activity,
  FileWarning,
} from "lucide-react";

// --- INTERFACES (Keep these exactly as they were) ---
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
type BankAccountInfo = {
  accountNumber: string;
  accountType: string;
  status: string;
  balance: number;
};
type CustomerLookupResponse = {
  userId: number;
  ownerName: string;
  email: string;
  mobileNumber: string;
  matchedAccountNumber: string | null;
  accounts: BankAccountInfo[];
};
interface RejectedResponse {
  id: number;
  makerUserId: number;
  makerName: string;
  checkerUserId: number | null;
  fromAccountId: number;
  toAccountId: number;
  amount: number;
  status: string;
  remark: string;
  createdAt: string;
  reviewedAt: string | null;
}

export default function AdminDashboard() {
  const { logout, role } = useAuth();
  const queryClient = useQueryClient(); // 🔥 Gives us access to the cache!

  // --- UI STATE (Only keep things that control the screen, not the data) ---
  const [activeTab, setActiveTab] = useState<
    "transfers" | "accounts" | "manage" | "staff" | "audit" | "Rejected"
  >("transfers");
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  // Manage Accounts State
  const [searchAccNum, setSearchAccNum] = useState("");
  const [managedAccount, setManagedAccount] =
    useState<CustomerLookupResponse | null>(null);
  const [selectedAccForManage, setSelectedAccForManage] = useState<string>("");
  const [manageForm, setManageForm] = useState({
    newStatus: "Active",
    remarks: "",
  });
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // Staff Provisioning State
  const [staffProvisionStep, setStaffProvisionStep] = useState<1 | 2 | 3>(1);
  const [staffOtpForm, setStaffOtpForm] = useState({
    email: "",
    mobileNumber: "",
  });
  const [staffOtpVerify, setStaffOtpVerify] = useState({
    mobileOtp: "",
    emailOtp: "",
  });
  const [staffProvisioningToken, setStaffProvisioningToken] = useState("");
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    email: "",
    mobileNumber: "",
    aadharNumber: "",
    staffProvisioningToken: "",
  });

  // Audit Pagination State
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("");

  // ==========================================
  // 🔥 THE REACT QUERY ENGINE
  // ==========================================

  
  // 1. Fetch Pending Transfers
  const { data: pendingTransfers = [], isLoading: isTransfersLoading } =
    useQuery<PendingTransfer[]>({
      queryKey: ["pendingTransfers"],
      queryFn: () =>
        axiosClient.get("/api/approvals/pending").then((res) => res.data),
      enabled: activeTab === "transfers", // Only fetch if the user actually clicks this tab!
    });

  // 2. Fetch Pending Accounts
  const { data: pendingAccounts = [], isLoading: isAccountsLoading } = useQuery<
    PendingAccount[]
  >({
    queryKey: ["pendingAccounts"],
    queryFn: () =>
      axiosClient.get("/api/admin/accounts/pending").then((res) => res.data),
    enabled: activeTab === "accounts",
  });

  // 3. Fetch Rejected Transfers
  const { data: rejected = [], isLoading: isRejectedLoading } = useQuery<
    RejectedResponse[]
  >({
    queryKey: ["rejectedTransfers"],
    queryFn: () =>
      axiosClient.get("/api/approvals/rejected").then((res) => res.data),
    enabled: activeTab === "Rejected",
  });

  // 4. Fetch Audit Logs (Notice how queryKey changes when page or filter changes!)
  const {
    data: auditData = { data: [], pagination: { totalPages: 1 } },
    isLoading: isAuditLoading,
  } = useQuery({
    queryKey: ["auditLogs", auditPage, auditActionFilter],
    queryFn: () =>
      axiosClient
        .get("/api/audit/logs", {
          params: {
            page: auditPage,
            pageSize: 15,
            action: auditActionFilter || undefined,
          },
        })
        .then((res) => res.data),
    enabled: activeTab === "audit",
  });

  const { data: auditAvailableActions = [] } = useQuery<string[]>({
    queryKey: ["auditActions"],
    queryFn: () =>
      axiosClient
        .get("/api/audit/actions")
        .then((res) => res.data.actions || []),
    enabled: activeTab === "audit",
  });

  // ==========================================
  // 🔥 THE REACT QUERY MUTATIONS (Updating Data)
  // ==========================================

  const resolveTransferMutation = useMutation({
    mutationFn: ({ id, isApproved }: { id: number; isApproved: boolean }) =>
      axiosClient.post(`/api/approvals/${id}/resolve`, {
        isApproved,
        remark: isApproved ? "Approved by CTO" : "Rejected by CTO",
      }),
    onSuccess: (data, variables) => {
      setFeedback({
        message:
          data.data.message ||
          `Transfer ${variables.isApproved ? "approved" : "rejected"}.`,
        isError: false,
      });
      queryClient.invalidateQueries({ queryKey: ["pendingTransfers"] }); // 🔥 Instantly refreshes the list!
    },
    onError: (error: any) =>
      setFeedback({
        message: error.response?.data?.Message || "Failed to resolve transfer.",
        isError: true,
      }),
  });

  const resolveAccountMutation = useMutation({
    mutationFn: ({
      accountNumber,
      newStatus,
    }: {
      accountNumber: string;
      newStatus: string;
    }) =>
      axiosClient.put(`/api/admin/accounts/${accountNumber}/status`, {
        newStatus,
        remarks:
          newStatus === "Active"
            ? "Account verified and activated."
            : "Account rejected.",
      }),
    onSuccess: (data, variables) => {
      setFeedback({
        message: data.data.Message || `Account ${variables.newStatus}.`,
        isError: false,
      });
      queryClient.invalidateQueries({ queryKey: ["pendingAccounts"] }); // 🔥 Instantly refreshes the list!
    },
    onError: (error: any) =>
      setFeedback({
        message: error.response?.data || "Failed to update account.",
        isError: true,
      }),
  });

  const manageAccountStatusMutation = useMutation({
    mutationFn: () =>
      axiosClient.put(`/api/admin/accounts/${selectedAccForManage}/status`, {
        newStatus: manageForm.newStatus,
        remarks: manageForm.remarks,
      }),
    onSuccess: (data) => {
      setFeedback({
        message:
          data.data.Message ||
          `Status successfully updated to ${manageForm.newStatus}`,
        isError: false,
      });
      // Update local UI state
      setManagedAccount((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.map((acc) =>
            acc.accountNumber === selectedAccForManage
              ? { ...acc, status: manageForm.newStatus }
              : acc,
          ),
        };
      });
      setManageForm({ newStatus: "Active", remarks: "" });
    },
    onError: (error: any) =>
      setFeedback({
        message: error.response?.data || "Failed to update status.",
        isError: true,
      }),
  });

  // ==========================================
  // LEGACY FORMS (Manage & Staff)
  // ==========================================
  const handleSearchForManage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSearchLoading(true);
    setFeedback({ message: "", isError: false });
    setManagedAccount(null);
    setSelectedAccForManage("");
    try {
      const response = await axiosClient.get(`/api/accounts/${searchAccNum}`);
      const data: CustomerLookupResponse = response.data;
      setManagedAccount(data);
      if (data.matchedAccountNumber)
        setSelectedAccForManage(data.matchedAccountNumber);
      else if (data.accounts?.length > 0)
        setSelectedAccForManage(data.accounts[0].accountNumber);
      setFeedback({ message: "Customer file found.", isError: false });
    } catch {
      setFeedback({ message: "Customer or Account not found.", isError: true });
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleSendStaffOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback({ message: "Sending OTPs...", isError: false });
    try {
      await axiosClient.post("/api/admin/staff/send-otp", staffOtpForm);
      setFeedback({
        message: "Verification codes sent to email and mobile.",
        isError: false,
      });
      setStaffProvisionStep(2);
    } catch (err: any) {
      setFeedback({
        message: err.response?.data || "Failed to send OTPs.",
        isError: true,
      });
    }
  };

  const handleVerifyStaffOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await axiosClient.post("/api/admin/staff/verify-otp", {
        ...staffOtpForm,
        ...staffOtpVerify,
      });
      setStaffProvisioningToken(response.data.staffProvisioningToken);
      setStaffForm((prev) => ({
        ...prev,
        email: staffOtpForm.email,
        mobileNumber: staffOtpForm.mobileNumber,
        staffProvisioningToken: response.data.staffProvisioningToken,
      }));
      setFeedback({
        message: "Contact verified. Enter staff details.",
        isError: false,
      });
      setStaffProvisionStep(3);
    } catch (err: any) {
      setFeedback({
        message: err.response?.data || "Invalid verification codes.",
        isError: true,
      });
    }
  };

  const handleProvisionStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await axiosClient.post(
        "/api/admin/provision-staff",
        staffForm,
      );
      setFeedback({
        message: response.data.message || "Teller provisioned successfully.",
        isError: false,
      });
      handleResetStaffProvisioning();
    } catch (err: any) {
      setFeedback({
        message: err.response?.data || "Failed to provision staff.",
        isError: true,
      });
    }
  };

  const handleResetStaffProvisioning = () => {
    setStaffProvisionStep(1);
    setStaffOtpForm({ email: "", mobileNumber: "" });
    setStaffOtpVerify({ mobileOtp: "", emailOtp: "" });
    setStaffForm({
      fullName: "",
      email: "",
      mobileNumber: "",
      aadharNumber: "",
      staffProvisioningToken: "",
    });
    setStaffProvisioningToken("");
  };

  // ==========================================
  // THE UI
  // ==========================================
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
              <h1 className="text-2xl font-bold text-slate-900">
                Admin Control Center
              </h1>
              <p className="text-slate-500 text-sm">
                Authorized as:{" "}
                <span className="font-bold text-indigo-600 uppercase tracking-wider">
                  {role}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-slate-500 hover:text-rose-500 font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </header>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button
            onClick={() => {
              setActiveTab("transfers");
              setFeedback({ message: "", isError: false });
            }}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "transfers" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <Clock className="w-5 h-5" /> Pending Transfers
          </button>
          <button
            onClick={() => {
              setActiveTab("accounts");
              setFeedback({ message: "", isError: false });
            }}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "accounts" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <Landmark className="w-5 h-5" /> Approvals
          </button>
          <button
            onClick={() => {
              setActiveTab("manage");
              setFeedback({ message: "", isError: false });
              setManagedAccount(null);
            }}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "manage" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <Settings className="w-5 h-5" /> Manage Accounts
          </button>
          <button
            onClick={() => {
              setActiveTab("staff");
              setFeedback({ message: "", isError: false });
            }}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "staff" ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <UserPlus className="w-5 h-5" /> Provision Teller
          </button>
          <button
            onClick={() => {
              setActiveTab("Rejected");
              setFeedback({ message: "", isError: false });
            }}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "Rejected" ? "bg-rose-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <FileWarning className="w-5 h-5" /> Rejected Approvals
          </button>
          <button
            onClick={() => {
              setActiveTab("audit");
              setFeedback({ message: "", isError: false });
            }}
            className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${activeTab === "audit" ? "bg-slate-800 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}
          >
            <Archive className="w-5 h-5" /> Audit Log
          </button>
        </div>

        {/* Global Feedback Alert */}
        {feedback.message && (
          <div
            className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 animate-in fade-in ${feedback.isError ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}
          >
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
              <h2 className="text-lg font-bold text-slate-900">
                Maker-Checker Approvals
              </h2>
              <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-bold">
                {pendingTransfers.length} Pending
              </span>
            </div>
            {isTransfersLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : pendingTransfers.length === 0 ? (
              <p className="text-center py-16 text-slate-500">
                No pending transfers require approval.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingTransfers.map((transfer) => (
                  <li
                    key={transfer.id}
                    className="p-6 hover:bg-slate-50/50 flex flex-col md:flex-row justify-between gap-6"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="text-sm text-slate-500 font-medium">
                        ID: #{transfer.id} • Req by:{" "}
                        <strong className="text-slate-700">
                          {transfer.makerName}
                        </strong>
                      </div>
                      <div className="flex gap-4">
                        <div className="bg-white border p-3 rounded-xl shadow-sm">
                          <p className="text-xs text-slate-400">SENDER ID</p>
                          <p className="font-mono">{transfer.fromAccountId}</p>
                        </div>
                        <ArrowRight className="text-slate-300 mt-5" />
                        <div className="bg-white border p-3 rounded-xl shadow-sm">
                          <p className="text-xs text-slate-400">RECEIVER ID</p>
                          <p className="font-mono">{transfer.toAccountId}</p>
                        </div>
                      </div>
                      <p className="text-sm bg-amber-50 text-amber-700 p-2 rounded-lg inline-block border border-amber-100">
                        <strong>Flag:</strong> {transfer.remark}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-4">
                      <p className="text-3xl font-bold text-slate-900 flex items-center">
                        <IndianRupee className="w-6 h-6 text-slate-400" />
                        {transfer.amount.toLocaleString()}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            resolveTransferMutation.mutate({
                              id: transfer.id,
                              isApproved: false,
                            })
                          }
                          disabled={resolveTransferMutation.isPending}
                          className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                        <button
                          onClick={() =>
                            resolveTransferMutation.mutate({
                              id: transfer.id,
                              isApproved: true,
                            })
                          }
                          disabled={resolveTransferMutation.isPending}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1"
                        >
                          {resolveTransferMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" /> Approve
                            </>
                          )}
                        </button>
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
              <h2 className="text-lg font-bold text-slate-900">
                Pending Account Activations
              </h2>
              <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-bold">
                {pendingAccounts.length} Pending
              </span>
            </div>
            {isAccountsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : pendingAccounts.length === 0 ? (
              <p className="text-center py-16 text-slate-500">
                No accounts are pending activation.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingAccounts.map((acc) => (
                  <li
                    key={acc.accountNumber}
                    className="p-6 hover:bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6"
                  >
                    <div className="space-y-1">
                      <h4 className="text-lg font-bold text-slate-900">
                        {acc.ownerName}
                      </h4>
                      <p className="text-slate-500 text-sm">{acc.email}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm tracking-widest">
                          {acc.accountNumber}
                        </span>
                        <span className="bg-brand-50 text-brand-700 border border-brand-100 px-2 py-1 rounded text-xs font-bold uppercase">
                          {acc.accountType}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          resolveAccountMutation.mutate({
                            accountNumber: acc.accountNumber,
                            newStatus: "Rejected",
                          })
                        }
                        disabled={resolveAccountMutation.isPending}
                        className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 flex items-center gap-1"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={() =>
                          resolveAccountMutation.mutate({
                            accountNumber: acc.accountNumber,
                            newStatus: "Active",
                          })
                        }
                        disabled={resolveAccountMutation.isPending}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-1"
                      >
                        {resolveAccountMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" /> Activate
                          </>
                        )}
                      </button>
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
              <form
                onSubmit={handleSearchForManage}
                className="flex gap-4 max-w-lg"
              >
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Search Email, Phone, or Account No..."
                    value={searchAccNum}
                    onChange={(e) => setSearchAccNum(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchLoading}
                  className="bg-slate-800 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-900 transition-colors"
                >
                  {isSearchLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    "Find User"
                  )}
                </button>
              </form>
            ) : (
              <div className="max-w-2xl space-y-6 animate-in slide-in-from-right-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setManagedAccount(null);
                      setFeedback({ message: "", isError: false });
                    }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Search
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex items-center gap-4">
                  <div className="bg-indigo-600 p-4 rounded-full text-white">
                    <Users className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">
                      {managedAccount.ownerName}
                    </h3>
                    <p className="text-slate-600">
                      {managedAccount.email} • {managedAccount.mobileNumber}
                    </p>
                  </div>
                </div>

                <h4 className="font-bold text-slate-700 mt-4 mb-2 text-sm uppercase tracking-wider">
                  Select Account to Manage
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {managedAccount.accounts.map((acc) => (
                    <div
                      key={acc.accountNumber}
                      className={`p-4 border rounded-xl flex justify-between items-center transition-all ${selectedAccForManage === acc.accountNumber ? "border-indigo-500 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white"}`}
                    >
                      <div>
                        <p className="font-mono font-bold text-slate-800">
                          {acc.accountNumber}
                        </p>
                        <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
                          {acc.accountType} •{" "}
                          <span
                            className={
                              acc.status === "Active"
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }
                          >
                            {acc.status}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900 text-lg">
                          ₹
                          {acc.balance.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                        {selectedAccForManage !== acc.accountNumber && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAccForManage(acc.accountNumber)
                            }
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1"
                          >
                            Select Profile
                          </button>
                        )}
                        {selectedAccForManage === acc.accountNumber && (
                          <span className="text-xs font-bold text-indigo-600 mt-1 block">
                            Selected ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {selectedAccForManage && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      manageAccountStatusMutation.mutate();
                    }}
                    className="space-y-4 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm"
                  >
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        New Account Status
                      </label>
                      <select
                        value={manageForm.newStatus}
                        onChange={(e) =>
                          setManageForm({
                            ...manageForm,
                            newStatus: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended (Freeze)</option>
                        <option value="Rejected">Rejected</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">
                        Audit Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        value={manageForm.remarks}
                        onChange={(e) =>
                          setManageForm({
                            ...manageForm,
                            remarks: e.target.value,
                          })
                        }
                        placeholder="Reason for status change..."
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={manageAccountStatusMutation.isPending}
                      className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md mt-4"
                    >
                      {manageAccountStatusMutation.isPending ? (
                        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                      ) : (
                        "Update Selected Account Status"
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 4: STAFF PROVISIONING (Leaving unchanged logic, just UI updates) */}
        {/* ========================================== */}
        {activeTab === "staff" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 animate-in fade-in">
            {/* ... Your exact existing Staff Provisioning code ... */}
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Users className="text-indigo-600" /> Provision New Teller
            </h2>
            <div className="flex items-center justify-between mb-8 relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
              <div
                className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 -z-10 rounded-full transition-all duration-500"
                style={{
                  width:
                    staffProvisionStep === 1
                      ? "0%"
                      : staffProvisionStep === 2
                        ? "50%"
                        : "100%",
                }}
              ></div>
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-colors ${staffProvisionStep >= step ? "bg-indigo-600 border-indigo-100 text-white" : "bg-slate-100 border-white text-slate-400"}`}
                >
                  {step}
                </div>
              ))}
            </div>

            <div className="max-w-lg mx-auto">
              {staffProvisionStep === 1 && (
                <form
                  onSubmit={handleSendStaffOtp}
                  className="space-y-5 animate-in slide-in-from-right-4"
                >
                  {/* ... Step 1 Fields ... */}
                  <input
                    type="email"
                    required
                    value={staffOtpForm.email}
                    onChange={(e) =>
                      setStaffOtpForm({
                        ...staffOtpForm,
                        email: e.target.value,
                      })
                    }
                    placeholder="staff@minibank.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="tel"
                    required
                    value={staffOtpForm.mobileNumber}
                    onChange={(e) =>
                      setStaffOtpForm({
                        ...staffOtpForm,
                        mobileNumber: e.target.value,
                      })
                    }
                    placeholder="Mobile Number"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700"
                  >
                    Send Verification Codes
                  </button>
                </form>
              )}
              {staffProvisionStep === 2 && (
                <form
                  onSubmit={handleVerifyStaffOtp}
                  className="space-y-5 animate-in slide-in-from-right-4"
                >
                  {/* ... Step 2 Fields ... */}
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={staffOtpVerify.mobileOtp}
                    onChange={(e) =>
                      setStaffOtpVerify({
                        ...staffOtpVerify,
                        mobileOtp: e.target.value,
                      })
                    }
                    placeholder="Mobile OTP"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 text-center font-mono tracking-widest"
                  />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={staffOtpVerify.emailOtp}
                    onChange={(e) =>
                      setStaffOtpVerify({
                        ...staffOtpVerify,
                        emailOtp: e.target.value,
                      })
                    }
                    placeholder="Email OTP"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 text-center font-mono tracking-widest"
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => setStaffProvisionStep(1)}
                      className="px-6 py-4 rounded-xl font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700"
                    >
                      Verify & Continue
                    </button>
                  </div>
                </form>
              )}
              {staffProvisionStep === 3 && (
                <form
                  onSubmit={handleProvisionStaff}
                  className="space-y-5 animate-in slide-in-from-right-4"
                >
                  {/* ... Step 3 Fields ... */}
                  <input
                    type="text"
                    required
                    value={staffForm.fullName}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, fullName: e.target.value })
                    }
                    placeholder="Full Legal Name"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    required
                    maxLength={12}
                    value={staffForm.aadharNumber}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        aadharNumber: e.target.value,
                      })
                    }
                    placeholder="Government ID (12-Digit)"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest"
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={handleResetStaffProvisioning}
                      className="px-6 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700"
                    >
                      Provision Teller
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
                <h2 className="text-lg font-bold text-slate-900">
                  Audit Trail
                </h2>
              </div>
            </div>

            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Filter by Action
              </label>
              <select
                value={auditActionFilter}
                onChange={(e) => {
                  setAuditActionFilter(e.target.value);
                  setAuditPage(1);
                }}
                className="w-full md:w-64 px-4 py-2 rounded-xl border border-slate-200 bg-white"
              >
                <option value="">All Actions</option>
                {auditAvailableActions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </div>

            {isAuditLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : auditData.data.length === 0 ? (
              <p className="text-center py-16 text-slate-500">
                No audit logs found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        Timestamp
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        Performed By
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        Target User
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        Changes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditData.data.map((log: AuditLog) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          #{log.id}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs">
                            {log.performedByUserId}
                          </span>{" "}
                          <span className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-white">
                            {log.performedByRole}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          #{log.targetUserId}
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="text-xs">
                            <span className="text-rose-600 line-through mr-2">
                              {log.oldValue || "—"}
                            </span>
                            <ArrowRight className="inline w-3 h-3 text-slate-400 mx-1" />
                            <span className="text-emerald-600 font-bold ml-2">
                              {log.newValue || "—"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {auditData.pagination.totalPages > 1 && (
              <div className="p-6 border-t border-slate-100 flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  Page <strong>{auditPage}</strong> of{" "}
                  <strong>{auditData.pagination.totalPages}</strong>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAuditPage(auditPage - 1)}
                    disabled={auditPage === 1 || isAuditLoading}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setAuditPage(auditPage + 1)}
                    disabled={
                      auditPage === auditData.pagination.totalPages ||
                      isAuditLoading
                    }
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 6: REJECTED TRANSFERS */}
        {/* ========================================== */}
        {activeTab === "Rejected" && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileWarning className="w-5 h-5 text-rose-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Rejected Transfers Archive
                </h2>
              </div>
              <span className="ml-auto bg-slate-200 text-slate-700 py-1 px-3 rounded-full text-xs font-bold">
                {rejected.length} Records
              </span>
            </div>

            {isRejectedLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : rejected.length === 0 ? (
              <p className="text-center py-16 text-slate-500">
                No Rejected Transactions found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        ID
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        Maker
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        From/To
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left font-bold text-slate-700">
                        Remark
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rejected.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          #{log.id}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs text-slate-400">
                              ID: {log.makerUserId}
                            </span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold w-max">
                              {log.makerName}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">
                          {log.fromAccountId} → {log.toAccountId}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold flex items-center w-max">
                            <IndianRupee className="w-3 h-3 mr-1" />
                            {log.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs">
                          {log.remark}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
