import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Briefcase, ArrowRight, Loader2, Eye, EyeOff, AlertCircle, Lock } from "lucide-react";
import axiosClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";

type Step = 1 | 2;

export default function StaffLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", isError: false });

  // ==========================================
  // STEP 1: LOGIN WITH EMAIL & PASSWORD
  // ==========================================
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setFeedback({ message: "", isError: false });

    try {
      const response = await axiosClient.post("/api/auth/staff-login", {
        email,
        password
      });

      // Check if password reset is required
      if (response.status === 400 && response.data?.Code === "FORCE_PASSWORD_RESET") {
        setFeedback({
          message: "You must change your temporary password before continuing.",
          isError: false
        });
        setStep(2);
      } else {
        // Successful login - save tokens and redirect
        login(response.data.token, response.data.refreshToken);

        // Redirect based on role
        if (response.data.role === "Admin") {
          navigate("/admin-dashboard");
        } else if (response.data.role === "Teller") {
          navigate("/staff-dashboard");
        } else {
          navigate("/dashboard");
        }
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.Message ||
                      error.response?.data?.message ||
                      error.response?.data ||
                      "Invalid email or password.";
      setFeedback({ message: typeof errorMsg === 'string' ? errorMsg : "Login failed.", isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // STEP 2: CHANGE PASSWORD
  // ==========================================
  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setFeedback({ message: "New passwords do not match.", isError: true });
      return;
    }

    // Validate password strength (at least 8 chars)
    if (newPassword.length < 8) {
      setFeedback({ message: "Password must be at least 8 characters.", isError: true });
      return;
    }

    setIsLoading(true);
    setFeedback({ message: "", isError: false });

    try {
      await axiosClient.post("/api/auth/change-password", {
        email,
        oldTempPassword: password,
        newPassword
      });

      setFeedback({ message: "Password changed successfully. Logging you in...", isError: false });

      // After password change, try to login with new password
      setTimeout(async () => {
        try {
          const loginResponse = await axiosClient.post("/api/auth/staff-login", {
            email,
            password: newPassword
          });

          login(loginResponse.data.token, loginResponse.data.refreshToken);

          if (loginResponse.data.role === "Admin") {
            navigate("/admin-dashboard");
          } else if (loginResponse.data.role === "Teller") {
            navigate("/staff-dashboard");
          } else {
            navigate("/dashboard");
          }
        } catch (loginError: any) {
          setFeedback({
            message: "Password changed but login failed. Please try logging in manually.",
            isError: true
          });
        }
      }, 1000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.Message ||
                      error.response?.data?.message ||
                      error.response?.data ||
                      "Failed to change password.";
      setFeedback({ message: typeof errorMsg === 'string' ? errorMsg : "Password change failed.", isError: true });
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
          {step === 1
            ? "Log in with your staff email and password"
            : "Set a new secure password for your account"}
        </p>

        {/* Global Feedback */}
        {feedback.message && (
          <div className={`p-4 rounded-xl text-sm font-medium flex items-center gap-2 mb-6 animate-in fade-in ${
            feedback.isError
              ? "bg-rose-50 text-rose-600 border border-rose-100"
              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
          }`}>
            {feedback.isError ? <AlertCircle className="w-5 h-5 shrink-0" /> : <Lock className="w-5 h-5 shrink-0" />}
            {feedback.message}
          </div>
        )}

        {/* STEP 1: LOGIN */}
        {step === 1 && (
          <form onSubmit={handleLogin} className="space-y-4 animate-in slide-in-from-right-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@minibank.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-400 mt-6"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="text-center text-sm text-slate-500 mt-4">
              <Link to="/" className="text-indigo-600 hover:underline font-medium">
                Customer login →
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: CHANGE PASSWORD */}
        {step === 2 && (
          <form onSubmit={handleChangePassword} className="space-y-4 animate-in slide-in-from-right-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
              <p className="text-sm text-indigo-700">
                <strong>Security Notice:</strong> This is your first login. You must set a new password to continue.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">Use uppercase, lowercase, numbers, and symbols for security.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:bg-indigo-400 mt-6"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Set New Password & Login <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
