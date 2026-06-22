// src/features/admin/components/PendingTransfersTab.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle, XCircle, ArrowRight, IndianRupee, AlertCircle } from "lucide-react";
import axiosClient from "../../../api/axiosClient";
import type { PendingTransfer } from "../types";

export default function PendingTransfersTab() {
  const queryClient = useQueryClient();
  
  // 🔥 Self-contained feedback state (Doesn't pollute the main dashboard!)
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  // 1. Fetch Data
  const { data: pendingTransfers = [], isLoading } = useQuery<PendingTransfer[]>({
    queryKey: ['pendingTransfers'],
    queryFn: () => axiosClient.get("/api/approvals/pending").then(res => res.data),
  });

  // 2. Mutate Data
  const resolveTransferMutation = useMutation({
    mutationFn: ({ id, isApproved }: { id: number, isApproved: boolean }) => 
      axiosClient.post(`/api/approvals/${id}/resolve`, { isApproved, remark: isApproved ? "Approved by Admin" : "Rejected by Admin" }),
    onSuccess: (data, variables) => {
      setFeedback({ message: data.data.message || `Transfer ${variables.isApproved ? 'approved' : 'rejected'}.`, isError: false });
      queryClient.invalidateQueries({ queryKey: ['pendingTransfers'] });
    },
    onError: (error: any) => setFeedback({ message: error.response?.data?.Message || "Failed to resolve transfer.", isError: true })
  });

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
      
      {/* Component-Level Feedback */}
      {feedback.message && (
        <div className={`m-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${feedback.isError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          {feedback.isError && <AlertCircle className="w-5 h-5 shrink-0" />}
          {feedback.message}
        </div>
      )}

      <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <h2 className="text-lg font-bold text-slate-900">Maker-Checker Approvals</h2>
        <span className="ml-auto bg-indigo-100 text-indigo-700 py-1 px-3 rounded-full text-xs font-bold">{pendingTransfers.length} Pending</span>
      </div>

      {isLoading ? (
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
                  <button onClick={() => resolveTransferMutation.mutate({ id: transfer.id, isApproved: false })} disabled={resolveTransferMutation.isPending} className="px-4 py-2 border border-rose-200 text-rose-600 rounded-lg font-bold hover:bg-rose-50 flex items-center gap-1"><XCircle className="w-4 h-4"/> Reject</button>
                  <button onClick={() => resolveTransferMutation.mutate({ id: transfer.id, isApproved: true })} disabled={resolveTransferMutation.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1">
                    {resolveTransferMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <><CheckCircle className="w-4 h-4"/> Approve</>}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}