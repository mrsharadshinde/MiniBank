import { useState } from 'react';
import { Wallet, ArrowRight, Loader2, CheckCircle2, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext'; 

export default function Login() {
  const { login } = useAuth(); 

  // 1. Expanded React State
  const [step, setStep] = useState<1 | 2>(1); 
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // 2. Step 1: Send the SMS
  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); 
    setIsLoading(true);
    setFeedbackMsg('');

    try {
      await axiosClient.post('/api/auth/request-otp', { loginId: phoneNumber });
      setStep(2); 
      setFeedbackMsg('Secure code sent to your phone.');
    } catch (error) {
      setFeedbackMsg('Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Step 2: Verify the Code & Login
  const handleVerifyOtp = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedbackMsg('');

    try {
      const response = await axiosClient.post('/api/auth/verify-otp', { 
        loginId: phoneNumber, 
        otp: otp 
      });

      // The global context now handles saving the keys AND the navigation!
      login(response.data.token, response.data.refreshToken);
      
    } catch (error) {
      setFeedbackMsg('Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // 4. The UI (Conditional Rendering)
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
            : `We sent a code to ${phoneNumber}.`}
        </p>
        
        {/* CONDITIONAL RENDERING: Show Form 1 OR Form 2 */}
        {step === 1 ? (
          
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Login ID</label>
              <input 
                type="tel" 
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Acc No / Addhar No / Mobile / Email"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            {feedbackMsg && <p className="text-sm text-center text-rose-500">{feedbackMsg}</p>}

            <button type="submit" disabled={isLoading} className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 flex items-center justify-center gap-2 disabled:bg-brand-400">
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Send Secure Code <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>

        ) : (

          <form onSubmit={handleVerifyOtp} className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">6-Digit Code</label>
              <input 
                type="text" 
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="000000"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-center text-2xl tracking-widest font-mono"
                required
              />
            </div>

            {feedbackMsg && (
              <p className={`text-sm text-center ${feedbackMsg.includes('successful') ? 'text-emerald-600' : 'text-rose-500'}`}>
                {feedbackMsg}
              </p>
            )}

            <button type="submit" disabled={isLoading} className="w-full bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 flex items-center justify-center gap-2 disabled:bg-brand-400">
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Verify & Login <CheckCircle2 className="w-5 h-5" /></>}
            </button>
            
            <button type="button" onClick={() => setStep(1)} className="w-full text-slate-500 text-sm font-medium hover:text-slate-800 transition-colors mt-2">
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