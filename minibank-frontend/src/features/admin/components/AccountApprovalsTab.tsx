// src/features/admin/components/AccountApprovalsTab.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import axiosClient from "../../../api/axiosClient";
import type { PendingAccount } from "../types";

export default function AccountApprovalsTab() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  const { data: pendingAccounts = [], isLoading } = useQuery<PendingAccount[]>({
    queryKey: ['pendingAccounts'],
    queryFn: () => axiosClient.get("/api/admin/accounts/pending").then(res => res.data),
  });

  const resolveAccountMutation = useMutation({
    mutationFn: ({ accountNumber, newStatus }: { accountNumber: string, newStatus: string }) => 
      axiosClient.put(`/api/admin/accounts/${accountNumber}/status`, { newStatus, remarks: newStatus === "Active" ? "Account verified and activated." : "Account rejected." }),
    onSuccess: (data, variables) => {
      setFeedback({ message: data.data.Message || `Account ${variables.newStatus}.`, isError: false });
      queryClient.invalidateQueries({ queryKey: ['pendingAccounts'] });
    },
    onError: (error: any) => setFeedback({ message: error.response?.data || "Failed to update account.", isError: true })
  });

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
      
      {feedback.message && (
        <div className={`m-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${feedback.isError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          {feedback.isError && <AlertCircle className="w-5 h-5 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">Pending Account Activations</h2>
        <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-bold">{pendingAccounts.length} Pending</span>
      </div>

      {isLoading ? (
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
                <button onClick={() => resolveAccountMutation.mutate({ accountNumber: acc.accountNumber, newStatus: "Rejected" })} disabled={resolveAccountMutation.isPending} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 flex items-center gap-1"><XCircle className="w-4 h-4"/> Reject</button>
                <button onClick={() => resolveAccountMutation.mutate({ accountNumber: acc.accountNumber, newStatus: "Active" })} disabled={resolveAccountMutation.isPending} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 flex items-center gap-1">
                  {resolveAccountMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <><CheckCircle className="w-4 h-4"/> Activate</>}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}