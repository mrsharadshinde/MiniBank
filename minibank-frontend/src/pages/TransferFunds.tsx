// src/pages/TransferFunds.tsx
import { useState, useEffect } from "react";
import { Send, ArrowRight, Loader2, AlertCircle, CheckCircle2, IndianRupee } from "lucide-react";
import { Link } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useQuery } from "@tanstack/react-query"; 
import { useForm } from "react-hook-form"; 
import { zodResolver } from "@hookform/resolvers/zod"; 
import * as z from "zod"; 
import axiosClient from "../api/axiosClient";

// 1. THE ZOD SCHEMA: This is our bulletproof blueprint
// Change your Zod schema to look like this:
const transferSchema = z.object({
  fromAccountNumber: z.string().min(1, "Please select an account"),
  toAccountNumber: z.string()
    .min(10, "Account number must be at least 10 digits")
    .max(16, "Account number cannot exceed 16 digits")
    .regex(/^\d+$/, "Account number must contain only numbers"),
    
  amount: z.number({ message: "Please enter a valid amount" })
    .positive("Amount must be greater than zero")
    .max(1000000, "Transfers exceed the 10,00,000 maximum limit via web."),
});

// Automatically generate TypeScript types from the Zod Schema!
type TransferFormValues = z.infer<typeof transferSchema>;

export default function TransferFunds() {
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  // 2. FETCH ACCOUNTS WITH REACT QUERY
  const { data: myAccounts = [], isLoading: isLoadingAccounts } = useQuery({
    queryKey: ['activeAccounts'],
    queryFn: async () => {
      const response = await axiosClient.get("/api/accounts/me");
      return response.data.filter((a: any) => a.status === "Active");
    }
  });

  // 3. INITIALIZE REACT HOOK FORM
  const { 
    register, 
    handleSubmit, 
    setValue, 
    reset,
    formState: { errors, isSubmitting } 
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema), // Connect Zod to the form
  });

  // Auto-select the first account when the data loads
  useEffect(() => {
    if (myAccounts.length > 0) {
      setValue("fromAccountNumber", myAccounts[0].accountNumber);
    }
  }, [myAccounts, setValue]);

  // 4. THE SUBMISSION HANDLER
  // Notice how clean this is! If Zod fails, this function NEVER even runs.
  const onSubmit = async (data: TransferFormValues) => {
    setFeedback({ message: "", isError: false });

    try {
      const idempotencyKey = uuidv4();
      const response = await axiosClient.post("/api/transfers", data, {
        headers: { "X-Idempotency-Key": idempotencyKey }
      });

      setFeedback({ 
        message: response.data.message || response.data.Message || "Transfer completed successfully.", 
        isError: false 
      });
      
      // Clear the target and amount, but keep the sender selected
      reset({ toAccountNumber: "", amount: undefined });
      setValue("fromAccountNumber", data.fromAccountNumber);

    } catch (error: any) {
      let errorMsg = "Failed to process transfer. Please try again.";
      if (error.response?.data) {
        if (typeof error.response.data === 'string') errorMsg = error.response.data;
        else if (error.response.data.Message) errorMsg = error.response.data.Message;
      }
      setFeedback({ message: errorMsg, isError: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Send className="text-indigo-600 w-8 h-8" /> Send Money
          </h1>
          <Link to="/dashboard" className="text-slate-500 hover:text-indigo-600 font-medium transition-colors">
            Cancel & Return
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          {/* 🔥 Pass handleSubmit to the form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Sender Dropdown */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">From Account</label>
              {isLoadingAccounts ? (
                <div className="w-full px-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-slate-500">Loading accounts...</div>
              ) : (
                <select 
                  {...register("fromAccountNumber")} // 🔥 Connect to RHF
                  className={`w-full px-4 py-4 rounded-xl border focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium appearance-none cursor-pointer ${errors.fromAccountNumber ? 'border-rose-500' : 'border-slate-200'}`}
                >
                  {myAccounts.map((acc: any) => (
                    <option key={acc.accountNumber} value={acc.accountNumber}>
                      ...{acc.accountNumber.slice(-6)} (₹{acc.balance.toLocaleString('en-IN')})
                    </option>
                  ))}
                </select>
              )}
              {/* Auto Error Display */}
              {errors.fromAccountNumber && <p className="text-rose-500 text-sm mt-1">{errors.fromAccountNumber.message}</p>}
            </div>

            <div className="flex justify-center py-2">
              <div className="bg-slate-100 p-3 rounded-full">
                <ArrowRight className="text-slate-400 w-5 h-5 rotate-90 md:rotate-0" />
              </div>
            </div>

            {/* Receiver Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Recipient Account Number</label>
              <input 
                type="text" 
                placeholder="e.g. 100188811365"
                {...register("toAccountNumber")} // 🔥 Connect to RHF
                className={`w-full px-4 py-4 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest text-lg ${errors.toAccountNumber ? 'border-rose-500' : 'border-slate-200'}`}
              />
              {errors.toAccountNumber && <p className="text-rose-500 text-sm mt-1">{errors.toAccountNumber.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Amount (₹)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <IndianRupee className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="number" 
                  step="0.01"
                  placeholder="0.00"
                  // 🔥 FIX 2: Tell RHF to instantly cast this HTML string to a Math Number
                  {...register("amount", { valueAsNumber: true })} 
                  className={`w-full pl-12 pr-4 py-4 rounded-xl border focus:ring-2 focus:ring-indigo-500 font-bold text-xl text-slate-900 ${errors.amount ? 'border-rose-500' : 'border-slate-200'}`}
                />
              </div>
              {errors.amount && <p className="text-rose-500 text-sm mt-1">{errors.amount.message}</p>}
            </div>

            {/* Feedback Alert */}
            {feedback.message && (
              <div className={`p-4 rounded-xl text-sm font-medium flex items-start gap-3 animate-in fade-in ${feedback.isError ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                {feedback.isError ? <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />}
                <p>{feedback.message}</p>
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting || myAccounts.length === 0}
              className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : "Send Money Securely"}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}