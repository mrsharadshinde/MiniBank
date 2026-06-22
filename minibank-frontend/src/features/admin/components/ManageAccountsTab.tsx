// src/features/admin/components/ManageAccountsTab.tsx
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Settings, Search, ArrowLeft, Users, AlertCircle } from "lucide-react";
import axiosClient from "../../../api/axiosClient";
import type { CustomerLookupResponse } from "../types";

export default function ManageAccountsTab() {
  // UI State
  const [feedback, setFeedback] = useState({ message: "", isError: false });
  const [searchAccNum, setSearchAccNum] = useState("");
  const [managedAccount, setManagedAccount] = useState<CustomerLookupResponse | null>(null);
  const [selectedAccForManage, setSelectedAccForManage] = useState<string>(""); 
  const [manageForm, setManageForm] = useState({ newStatus: "Active", remarks: "" });

  // 1. MUTATION: Search for a Customer
  const searchCustomerMutation = useMutation({
    mutationFn: (searchVal: string) => axiosClient.get(`/api/accounts/${searchVal}`).then(res => res.data),
    onSuccess: (data: CustomerLookupResponse) => {
      setManagedAccount(data);
      if (data.matchedAccountNumber) setSelectedAccForManage(data.matchedAccountNumber);
      else if (data.accounts?.length > 0) setSelectedAccForManage(data.accounts[0].accountNumber);
      setFeedback({ message: "Customer file found.", isError: false });
    },
    onError: () => {
      setManagedAccount(null);
      setFeedback({ message: "Customer or Account not found.", isError: true });
    }
  });

  const handleSearchForManage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback({ message: "", isError: false });
    searchCustomerMutation.mutate(searchAccNum);
  };

  // 2. MUTATION: Update Account Status
  const manageAccountStatusMutation = useMutation({
    mutationFn: () => axiosClient.put(`/api/admin/accounts/${selectedAccForManage}/status`, { 
      newStatus: manageForm.newStatus, 
      remarks: manageForm.remarks 
    }),
    onSuccess: (data) => {
      setFeedback({ message: data.data.Message || data.data.message || `Status successfully updated to ${manageForm.newStatus}`, isError: false });
      
      // Instantly update the local UI to reflect the new status
      setManagedAccount(prev => {
        if (!prev) return prev;
        return { 
          ...prev, 
          accounts: prev.accounts.map(acc => acc.accountNumber === selectedAccForManage ? { ...acc, status: manageForm.newStatus } : acc) 
        };
      });
      setManageForm({ newStatus: "Active", remarks: "" });
    },
    onError: (error: any) => setFeedback({ message: error.response?.data || "Failed to update status.", isError: true })
  });

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 animate-in fade-in">
      <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <Settings className="text-indigo-600" /> Account Status Management
      </h2>

      {feedback.message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${feedback.isError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          {feedback.isError && <AlertCircle className="w-5 h-5 shrink-0" />}
          {feedback.message}
        </div>
      )}

      {!managedAccount ? (
        <form onSubmit={handleSearchForManage} className="flex gap-4 max-w-lg">
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
          <button type="submit" disabled={searchCustomerMutation.isPending} className="bg-slate-800 text-white px-8 py-3 rounded-xl font-semibold hover:bg-slate-900 transition-colors">
            {searchCustomerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Find User"}
          </button>
        </form>
      ) : (
        <div className="max-w-2xl space-y-6 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <button type="button" onClick={() => { setManagedAccount(null); setFeedback({message:"", isError:false}); }} className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Search
            </button>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl flex items-center gap-4">
            <div className="bg-indigo-600 p-4 rounded-full text-white"><Users className="w-8 h-8" /></div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">{managedAccount.ownerName}</h3>
              <p className="text-slate-600">{managedAccount.email} • {managedAccount.mobileNumber}</p>
            </div>
          </div>

          <h4 className="font-bold text-slate-700 mt-4 mb-2 text-sm uppercase tracking-wider">Select Account to Manage</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {managedAccount.accounts.map(acc => (
              <div key={acc.accountNumber} className={`p-4 border rounded-xl flex justify-between items-center transition-all ${selectedAccForManage === acc.accountNumber ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white'}`}>
                <div>
                  <p className="font-mono font-bold text-slate-800">{acc.accountNumber}</p>
                  <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
                    {acc.accountType} • <span className={acc.status === 'Active' ? 'text-emerald-600' : 'text-rose-600'}>{acc.status}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900 text-lg">₹{acc.balance.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
                  {selectedAccForManage !== acc.accountNumber && ( 
                    <button type="button" onClick={() => setSelectedAccForManage(acc.accountNumber)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1">Select Profile</button> 
                  )}
                  {selectedAccForManage === acc.accountNumber && ( 
                    <span className="text-xs font-bold text-indigo-600 mt-1 block">Selected ✓</span> 
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedAccForManage && (
            <form onSubmit={(e) => { e.preventDefault(); manageAccountStatusMutation.mutate(); }} className="space-y-4 bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">New Account Status</label>
                <select value={manageForm.newStatus} onChange={(e) => setManageForm({...manageForm, newStatus: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 bg-white">
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended (Freeze)</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Audit Remarks (Optional)</label>
                <input type="text" value={manageForm.remarks} onChange={(e) => setManageForm({...manageForm, remarks: e.target.value})} placeholder="Reason for status change..." className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"/>
              </div>
              <button type="submit" disabled={manageAccountStatusMutation.isPending} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md mt-4">
                {manageAccountStatusMutation.isPending ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Update Selected Account Status"}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}