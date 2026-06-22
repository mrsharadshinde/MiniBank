// src/pages/AdminDashboard.tsx
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, LogOut, Clock, Landmark, Settings, UserPlus, Archive, FileWarning } from "lucide-react";

// 🔥 1. Import our beautiful new Feature Components!
import PendingTransfersTab from "../features/admin/components/PendingTransfersTab";
import AccountApprovalsTab from "../features/admin/components/AccountApprovalsTab";
import ManageAccountsTab from "../features/admin/components/ManageAccountsTab";
import ProvisionStaffTab from "../features/admin/components/ProvisionStaffTab";
import AuditLogTab from "../features/admin/components/AuditLogTab";
import RejectedTransfersTab from "../features/admin/components/RejectedTransfersTab";

// Define the exact string names for our tabs to prevent typos
type TabType = "transfers" | "accounts" | "manage" | "staff" | "audit" | "Rejected";

export default function AdminDashboard() {
  const { logout, role } = useAuth();
  
  // 2. The ONLY state this component needs to track!
  const [activeTab, setActiveTab] = useState<TabType>("transfers");

  // Helper component to keep the navigation buttons DRY (Don't Repeat Yourself)
  const TabButton = ({ tab, icon: Icon, label, colorClass }: { tab: TabType, icon: any, label: string, colorClass: string }) => (
    <button 
      onClick={() => setActiveTab(tab)} 
      className={`px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-colors ${
        activeTab === tab 
          ? `${colorClass} text-white shadow-md` 
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
      }`}
    >
      <Icon className="w-5 h-5" /> {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Panel */}
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex justify-between items-center animate-in fade-in slide-in-from-top-4">
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
        <nav className="flex flex-wrap gap-4 mb-6">
          <TabButton tab="transfers" icon={Clock} label="Pending Transfers" colorClass="bg-indigo-600" />
          <TabButton tab="accounts" icon={Landmark} label="Approvals" colorClass="bg-indigo-600" />
          <TabButton tab="manage" icon={Settings} label="Manage Accounts" colorClass="bg-indigo-600" />
          <TabButton tab="staff" icon={UserPlus} label="Provision Teller" colorClass="bg-indigo-600" />
          <TabButton tab="Rejected" icon={FileWarning} label="Rejected Approvals" colorClass="bg-rose-600" />
          <TabButton tab="audit" icon={Archive} label="Audit Log" colorClass="bg-slate-800" />
        </nav>

        {/* 🔥 3. Tab Content Rendering (The Magic Wire-up) */}
        <main>
          {activeTab === "transfers" && <PendingTransfersTab />}
          {activeTab === "accounts" && <AccountApprovalsTab />}
          {activeTab === "manage" && <ManageAccountsTab />}
          {activeTab === "staff" && <ProvisionStaffTab />}
          {activeTab === "audit" && <AuditLogTab />}
          {activeTab === "Rejected" && <RejectedTransfersTab />}
        </main>

      </div>
    </div>
  );
}