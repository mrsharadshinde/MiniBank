// src/features/admin/components/AuditLogTab.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Activity, ArrowRight } from "lucide-react";
import axiosClient from "../../../api/axiosClient";
import type { AuditLog } from "../types";

export default function AuditLogTab() {
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("");

  // 1. Fetch the logs with pagination and filters
  const { data: auditData = { data: [], pagination: { totalPages: 1 } }, isLoading } = useQuery({
    queryKey: ['auditLogs', auditPage, auditActionFilter],
    queryFn: () => axiosClient.get("/api/audit/logs", { 
      params: { page: auditPage, pageSize: 15, action: auditActionFilter || undefined } 
    }).then(res => res.data),
  });

  // 2. Fetch the available action types for the dropdown filter
  const { data: auditAvailableActions = [] } = useQuery<string[]>({
    queryKey: ['auditActions'],
    queryFn: () => axiosClient.get("/api/audit/actions").then(res => res.data.actions || []),
  });

  return (
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
          onChange={(e) => { setAuditActionFilter(e.target.value); setAuditPage(1); }} 
          className="w-full md:w-64 px-4 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">All Actions</option>
          {auditAvailableActions.map((action) => (
            <option key={action} value={action}>{action}</option>
          ))}
        </select>
      </div>

      {/* Audit Logs Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : auditData.data.length === 0 ? (
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
                <th className="px-6 py-3 text-left font-bold text-slate-700">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditData.data.map((log: AuditLog) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">#{log.id}</td>
                  <td className="px-6 py-4 text-slate-600">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">{log.action}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs">{log.performedByUserId}</span> 
                    <span className={`px-2 py-1 ml-2 rounded text-xs font-bold ${log.performedByRole === 'Admin' ? 'bg-slate-800 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                      {log.performedByRole}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">#{log.targetUserId}</td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="text-xs">
                      <span className="text-rose-600 line-through mr-2">{log.oldValue || '—'}</span>
                      <ArrowRight className="inline w-3 h-3 text-slate-400 mx-1"/>
                      <span className="text-emerald-600 font-bold ml-2">{log.newValue || '—'}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {auditData.pagination.totalPages > 1 && (
        <div className="p-6 border-t border-slate-100 flex items-center justify-between">
          <span className="text-sm text-slate-600">Page <strong>{auditPage}</strong> of <strong>{auditData.pagination.totalPages}</strong></span>
          <div className="flex gap-2">
            <button 
              onClick={() => setAuditPage(auditPage - 1)} 
              disabled={auditPage === 1 || isLoading} 
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-50 transition-colors"
            >
              ← Prev
            </button>
            <button 
              onClick={() => setAuditPage(auditPage + 1)} 
              disabled={auditPage === auditData.pagination.totalPages || isLoading} 
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </section>
  );
}