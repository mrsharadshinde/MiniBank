// src/pages/Login.tsx
import { useState } from 'react';
import { Wallet, ArrowRight, Loader2, CheckCircle2, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useForm } from "react-hook-form"; 
import { zodResolver } from "@hookform/resolvers/zod"; 
import * as z from "zod"; 
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';

// 1. CREATE TWO SEPARATE SCHEMAS FOR THE WIZARD
const requestOtpSchema = z.object({
  loginId: z.string().min(4, "Please enter a valid Phone, Email, or Account Number"),
});

const verifyOtpSchema = z.object({
  otp: z.string()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
});

type RequestOtpValues = z.infer<typeof requestOtpSchema>;
type VerifyOtpValues = z.infer<typeof verifyOtpSchema>;

export default function Login() {
  const { login } = useAuth(); 

  // We still need React state to track which step we are on, 
  // and to remember the loginId between Step 1 and Step 2!
  const [step, setStep] = useState<1 | 2>(1); 
  const [savedLoginId, setSavedLoginId] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState({ text: '', isError: false });

  // 2. INITIALIZE HOOK 1 (Aliasing variables so they don't clash)
  const {
    register: registerReq,
    handleSubmit: handleSubmitReq,
    formState: { errors: errorsReq, isSubmitting: isSubmittingReq }
  } = useForm<RequestOtpValues>({
    resolver: zodResolver(requestOtpSchema)
  });

  // 3. INITIALIZE HOOK 2
  const {
    register: registerVer,
    handleSubmit: handleSubmitVer,
    formState: { errors: errorsVer, isSubmitting: isSubmittingVer },
    reset: resetVer
  } = useForm<VerifyOtpValues>({
    resolver: zodResolver(verifyOtpSchema)
  });

  // --- SUBMIT HANDLERS ---
  const handleRequestOtp = async (data: RequestOtpValues) => {
    setFeedbackMsg({ text: '', isError: false });
    try {
      await axiosClient.post('/api/auth/request-otp', { loginId: data.loginId });
      
      // Save the validated ID to React State so Step 2 can use it!
      setSavedLoginId(data.loginId); 
      setStep(2); 
      setFeedbackMsg({ text: 'Secure code sent to your phone.', isError: false });
      
    } catch (error) {
      setFeedbackMsg({ text: 'Failed to send OTP. Please try again.', isError: true });
    }
  };

  const handleVerifyOtp = async (data: VerifyOtpValues) => {
    setFeedbackMsg({ text: '', isError: false });
    try {
      const response = await axiosClient.post('/api/auth/verify-otp', { 
        loginId: savedLoginId, // Grabbed from React state!
        otp: data.otp          // Grabbed from React Hook Form!
      });

      const userRole = response.data.role || 'Customer';
      login(userRole);
      
    } catch (error: any) {
      setFeedbackMsg({ text: 'Invalid code. Please try again.', isError: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full">
        
        <div className="flex justify-center mb-6">
          <div className="bg-brand-50 w-16 h-16 flex items-center justify-center rounded-full">
            <Wallet className="text-brand-600 w-8 h-8" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
          {step === 1 ? 'Welcome Back' : 'Verify Identity'}
        </h1>
        <p className="text-slate-500 text-center mb-8">
          {step === 1 
            ? 'Enter your login ID to receive a secure code.' 
            : `We sent a code to Registred Mobile/Email.`}
        </p>
        
        {/* CONDITIONAL RENDERING: Show Form 1 OR Form 2 */}
        {step === 1 ? (
          
          <form onSubmit={handleSubmitReq(handleRequestOtp)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Login ID</label>
              <input 
                type="text" 
                placeholder="Acc No / Aadhar No / Mobile / Email"
                {...registerReq("loginId")} // 🔥 Connect to Hook 1
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 ${errorsReq.loginId ? 'border-rose-500' : 'border-slate-200'}`}
              />
              {errorsReq.loginId && <p className="text-rose-500 text-sm mt-1">{errorsReq.loginId.message}</p>}
            </div>

            {feedbackMsg.text && (
              <p className={`text-sm text-center ${feedbackMsg.isError ? 'text-rose-500' : 'text-emerald-600'}`}>{feedbackMsg.text}</p>
            )}

            <button type="submit" disabled={isSubmittingReq} className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 flex items-center justify-center gap-2 disabled:bg-brand-400">
              {isSubmittingReq ? <Loader2 className="animate-spin w-5 h-5" /> : <>Send Secure Code <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

        ) : (

          <form onSubmit={handleSubmitVer(handleVerifyOtp)} className="space-y-4" autoComplete="off">
            
            {/* 🔥 THE HONEYPOT: Catches aggressive browser autofill so it doesn't hit the OTP box */}
            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }}>
              <input type="text" name="fake_username_trap" tabIndex={-1} autoComplete="username" />
              <input type="password" name="fake_password_trap" tabIndex={-1} autoComplete="current-password" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">6-Digit Code</label>
              <input 
                type="text" 
                maxLength={6}
                placeholder="000000"
                {...registerVer("otp")} 
                autoComplete="new-password" // 🔥 The strongest flag to prevent standard autofill
                inputMode="numeric"
                className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 text-center text-2xl tracking-widest font-mono ${errorsVer.otp ? 'border-rose-500' : 'border-slate-200'}`}
              />
              {errorsVer.otp && <p className="text-rose-500 text-sm mt-1">{errorsVer.otp.message}</p>}
            </div>

            {feedbackMsg.text && (
              <p className={`text-sm text-center ${feedbackMsg.isError ? 'text-rose-500' : 'text-emerald-600'}`}>
                {feedbackMsg.text}
              </p>
            )}

            <button type="submit" disabled={isSubmittingVer} className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 flex items-center justify-center gap-2 disabled:bg-brand-400">
              {isSubmittingVer ? <Loader2 className="animate-spin w-5 h-5" /> : <>Verify & Login <CheckCircle2 className="w-5 h-5" /></>}
            </button>
            
            <button 
              type="button" 
              onClick={() => { setStep(1); resetVer(); setFeedbackMsg({text: '', isError: false}); }} 
              className="w-full text-slate-500 text-sm font-medium hover:text-slate-800 transition-colors mt-2"
            >
              Use a different number
            </button>
          </form>

        )}

        {/* Staff Login Link */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <p className="text-sm text-slate-500 text-center mb-3">Are you a staff member?</p>
          <Link
            to="/staff-login"
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Briefcase className="w-5 h-5" /> Staff Portal
          </Link>
        </div>

      </div>
    </div>
  );
}