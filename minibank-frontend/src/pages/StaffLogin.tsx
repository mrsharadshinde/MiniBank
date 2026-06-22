// src/pages/StaffLogin.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Briefcase, ArrowRight, Loader2, Eye, EyeOff, AlertCircle, Lock } from "lucide-react";
import axiosClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";

type Step = 1 | 2;
type LoginMethod = "password" | "otp"; 

export default function StaffLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("password");
  const [otpStep, setOtpStep] = useState<1 | 2>(1);

  // 🔥 FIX: Changed 'email' state to a universal 'loginId' state
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  // ==========================================
  // FLOW A: LOGIN WITH PASSWORD
  // ==========================================
  const handlePasswordLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true); setFeedback({ message: "", isError: false });

    try {
      // 🔥 Send loginId instead of email
      const response = await axiosClient.post("/api/auth/staff-login", { loginId, password });
      login(response.data.role || response.data.Role || 'Teller');
      
    } catch (error: any) {
      const data = error.response?.data;
      if (error.response?.status === 400 && (data?.code === "FORCE_PASSWORD_RESET" || data?.Code === "FORCE_PASSWORD_RESET")) {
        setFeedback({ message: data?.message || "You must change your temporary password.", isError: false });
        setStep(2);
        return;
      }
      setFeedback({ message: data?.Message || "Invalid credentials.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // FLOW B: LOGIN WITH OTP
  // ==========================================
  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true); setFeedback({ message: "", isError: false });

    try {
      await axiosClient.post("/api/auth/staff-request-otp", { loginId });
      setOtpStep(2);
      setFeedback({ message: "Verification code sent to your contact details.", isError: false });
    } catch (error: any) {
      setFeedback({ message: error.response?.data || "Failed to send OTP. Verify your Staff ID.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true); setFeedback({ message: "", isError: false });

    try {
      const response = await axiosClient.post("/api/auth/staff-verify-otp", { loginId, otp: otpCode });
      login(response.data.role || response.data.Role || 'Teller');
    } catch (error: any) {
      setFeedback({ message: error.response?.data || "Invalid verification code.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // STEP 2: CHANGE PASSWORD
  // ==========================================
  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setFeedback({ message: "New passwords do not match.", isError: true }); return; }
    if (newPassword.length < 8) { setFeedback({ message: "Password must be at least 8 characters.", isError: true }); return; }

    setIsLoading(true); setFeedback({ message: "", isError: false });

    try {
      // 🔥 Send loginId instead of email
      await axiosClient.post("/api/auth/change-password", { loginId, oldTempPassword: password, newPassword });
      setFeedback({ message: "Password changed successfully. Logging you in...", isError: false });

      setTimeout(async () => {
        try {
          const loginResponse = await axiosClient.post("/api/auth/staff-login", { loginId, password: newPassword });
          login(loginResponse.data.role || loginResponse.data.Role);
        } catch (loginError: any) {
          setFeedback({ message: "Password changed but login failed. Please retry.", isError: true });
          setStep(1); setLoginMethod("password");
        }
      }, 1000);
    } catch (error: any) {
      setFeedback({ message: error.response?.data?.Message || "Password change failed.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 max-w-md w-full p-8">

        {/* Header */}
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-100 w-16 h-16 flex items-center justify-center rounded-full">
            <Briefcase className="text-indigo-600 w-8 h-8" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">
          {step === 1 ? "Staff Portal" : "Update Password"}
        </h1>
        <p className="text-slate-500 text-center mb-8">
          {step === 1 ? "Secure access for MiniBank personnel" : "Set a new secure password"}
        </p>

        {feedback.message && (
          <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 mb-6 animate-in fade-in ${feedback.isError ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"}`}>
            {feedback.isError ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Lock className="w-5 h-5 shrink-0" />}
            {feedback.message}
          </div>
        )}

        {/* STEP 1: AUTHENTICATION SELECTION */}
        {step === 1 && (
          <div className="animate-in slide-in-from-right-4">
            
            <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => { setLoginMethod("password"); setFeedback({message:"", isError:false}); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginMethod === "password" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => { setLoginMethod("otp"); setFeedback({message:"", isError:false}); setOtpStep(1); }}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${loginMethod === "otp" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                OTP Code
              </button>
            </div>

            {/* FLOW A: PASSWORD */}
            {loginMethod === "password" && (
              <form onSubmit={handlePasswordLogin} className="space-y-4 animate-in fade-in">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Staff ID (Aadhar / Mobile / Email)</label>
                  <input type="text" required value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="Enter ID" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-400 mt-6">
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sign In <ArrowRight className="w-5 h-5" /></>}
                </button>
              </form>
            )}

            {/* FLOW B: OTP */}
            {loginMethod === "otp" && (
              <div className="animate-in fade-in">
                {otpStep === 1 ? (
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Staff ID (Aadhar / Mobile / Email)</label>
                      <input type="text" required value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="Enter ID" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all" />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-400">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send Secure Code <ArrowRight className="w-5 h-5" /></>}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-4" autoComplete="off">
                    <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }}>
                      <input type="text" name="fake_username_trap" tabIndex={-1} autoComplete="username" />
                      <input type="password" name="fake_password_trap" tabIndex={-1} autoComplete="current-password" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">6-Digit OTP</label>
                      <input type="text" required maxLength={6} value={otpCode} onChange={(e) => setOtpCode(e.target.value)} autoComplete="new-password" inputMode="numeric" placeholder="000000" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-center text-2xl tracking-widest font-mono transition-all" />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-400">
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify & Access Portal <ArrowRight className="w-5 h-5" /></>}
                    </button>
                    <button type="button" onClick={() => setOtpStep(1)} className="w-full text-slate-500 text-sm font-medium hover:text-slate-800 transition-colors mt-2">
                      Use a different ID
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="text-center text-sm text-slate-500 mt-6 pt-6 border-t border-slate-100">
              <Link to="/" className="text-indigo-600 hover:underline font-medium">Customer login →</Link>
            </div>
          </div>
        )}

        {/* STEP 2: CHANGE PASSWORD */}
        {step === 2 && (
          <form onSubmit={handleChangePassword} className="space-y-4 animate-in slide-in-from-right-4">
             <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
              <p className="text-sm text-indigo-700"><strong>Security Notice:</strong> You must set a new password to continue.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
              <div className="relative">
                <input type={showNewPassword ? "text" : "password"} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all" />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Confirm Password</label>
              <div className="relative">
                <input type={showNewPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all" />
              </div>
            </div>
            <button type="submit" disabled={isLoading} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-400 mt-6">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Set Password & Login <ArrowRight className="w-5 h-5" /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}