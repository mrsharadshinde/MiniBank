// src/features/admin/components/RejectedTransfersTab.tsx
import { useQuery } from "@tanstack/react-query";
import { Loader2, FileWarning, IndianRupee } from "lucide-react";
import axiosClient from "../../../api/axiosClient";
import type { RejectedResponse } from "../types";

export default function RejectedTransfersTab() {
  const { data: rejected = [], isLoading } = useQuery<RejectedResponse[]>({
    queryKey: ['rejectedTransfers'],
    queryFn: () => axiosClient.get("/api/approvals/rejected").then(res => res.data),
  });

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
      <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-bold text-slate-900">Rejected Transfers Archive</h2>
        </div>
        <span className="ml-auto bg-slate-200 text-slate-700 py-1 px-3 rounded-full text-xs font-bold">{rejected.length} Records</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : rejected.length === 0 ? (
        <p className="text-center py-16 text-slate-500">No Rejected Transactions found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left font-bold text-slate-700">ID</th>
                <th className="px-6 py-3 text-left font-bold text-slate-700">Maker</th>
                <th className="px-6 py-3 text-left font-bold text-slate-700">From/To</th>
                <th className="px-6 py-3 text-left font-bold text-slate-700">Amount</th>
                <th className="px-6 py-3 text-left font-bold text-slate-700">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rejected.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">#{log.id}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs text-slate-400">ID: {log.makerUserId}</span>
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold w-max">{log.makerName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{log.fromAccountId} → {log.toAccountId}</td>
                  <td className="px-6 py-4">
                    <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold flex items-center w-max">
                      <IndianRupee className="w-3 h-3 mr-1" />{log.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-xs">{log.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}