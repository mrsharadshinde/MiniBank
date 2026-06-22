// src/features/admin/components/ProvisionStaffTab.tsx
import { useState } from "react";
import { Loader2, Users, AlertCircle } from "lucide-react";
import axiosClient from "../../../api/axiosClient";

export default function ProvisionStaffTab() {
  // UI State specifically isolated for this 3-step wizard
  const [feedback, setFeedback] = useState({ message: "", isError: false });
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [staffProvisionStep, setStaffProvisionStep] = useState<1 | 2 | 3>(1);
  
  // Form State
  const [staffOtpForm, setStaffOtpForm] = useState({ email: "", mobileNumber: "" });
  const [staffOtpVerify, setStaffOtpVerify] = useState({ mobileOtp: "", emailOtp: "" });
  const [staffProvisioningToken, setStaffProvisioningToken] = useState("");
  const [staffForm, setStaffForm] = useState({ fullName: "", email: "", mobileNumber: "", aadharNumber: "", staffProvisioningToken: "" });

  const handleSendStaffOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsStaffLoading(true);
    setFeedback({ message: "Sending OTPs...", isError: false });
    try {
      await axiosClient.post("/api/admin/staff/send-otp", staffOtpForm);
      setFeedback({ message: "Verification codes sent to email and mobile.", isError: false });
      setStaffProvisionStep(2);
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.Message || err.response?.data || "Failed to send OTPs.", isError: true });
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleVerifyStaffOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsStaffLoading(true);
    try {
      const response = await axiosClient.post("/api/admin/staff/verify-otp", { ...staffOtpForm, ...staffOtpVerify });
      setStaffProvisioningToken(response.data.staffProvisioningToken);
      setStaffForm(prev => ({ 
        ...prev, 
        email: staffOtpForm.email, 
        mobileNumber: staffOtpForm.mobileNumber, 
        staffProvisioningToken: response.data.staffProvisioningToken 
      }));
      setFeedback({ message: "Contact verified. Enter staff details.", isError: false });
      setStaffProvisionStep(3);
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.Message || err.response?.data || "Invalid verification codes.", isError: true });
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleProvisionStaff = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsStaffLoading(true);
    try {
      const response = await axiosClient.post("/api/admin/provision-staff", staffForm);
      setFeedback({ message: response.data.message || "Teller provisioned successfully.", isError: false });
      handleResetStaffProvisioning();
    } catch (err: any) {
      setFeedback({ message: err.response?.data?.Message || err.response?.data || "Failed to provision staff.", isError: true });
    } finally {
      setIsStaffLoading(false);
    }
  };

  const handleResetStaffProvisioning = () => {
    setStaffProvisionStep(1); 
    setStaffOtpForm({ email: "", mobileNumber: "" }); 
    setStaffOtpVerify({ mobileOtp: "", emailOtp: "" });
    setStaffForm({ fullName: "", email: "", mobileNumber: "", aadharNumber: "", staffProvisioningToken: "" });
    setStaffProvisioningToken("");
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 animate-in fade-in">
      <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
        <Users className="text-indigo-600" /> Provision New Teller
      </h2>

      {/* Global Feedback Alert for this Tab */}
      {feedback.message && (
        <div className={`mb-8 p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${feedback.isError ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
          {feedback.isError && <AlertCircle className="w-5 h-5 shrink-0" />}
          {feedback.message}
        </div>
      )}

      {/* Progress Tracker */}
      <div className="flex items-center justify-between mb-8 relative max-w-lg mx-auto">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 -z-10 rounded-full"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 -z-10 rounded-full transition-all duration-500" style={{ width: staffProvisionStep === 1 ? '0%' : staffProvisionStep === 2 ? '50%' : '100%' }}></div>
        {[1, 2, 3].map((step) => (
          <div key={step} className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-4 transition-colors ${staffProvisionStep >= step ? 'bg-indigo-600 border-indigo-100 text-white' : 'bg-slate-100 border-white text-slate-400'}`}>
            {step}
          </div>
        ))}
      </div>

      <div className="max-w-lg mx-auto">
        {/* STEP 1: REQUEST OTP */}
        {staffProvisionStep === 1 && (
          <form onSubmit={handleSendStaffOtp} className="space-y-5 animate-in slide-in-from-right-4">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900">Contact Verification</h3>
              <p className="text-slate-500 text-sm">Step 1: Enter staff contact details to send verification codes.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
              <input type="email" required value={staffOtpForm.email} onChange={e => setStaffOtpForm({...staffOtpForm, email: e.target.value})} placeholder="staff@minibank.com" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Mobile Number</label>
              <input type="tel" required value={staffOtpForm.mobileNumber} onChange={e => setStaffOtpForm({...staffOtpForm, mobileNumber: e.target.value})} placeholder="e.g. 9876543210" className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <button type="submit" disabled={isStaffLoading} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md mt-4 flex justify-center">
              {isStaffLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Send Verification Codes"}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY OTP */}
        {staffProvisionStep === 2 && (
          <form onSubmit={handleVerifyStaffOtp} className="space-y-5 animate-in slide-in-from-right-4">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900">Enter Security Codes</h3>
              <p className="text-slate-500 text-sm">Step 2: Enter the verification codes sent to email and mobile.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Mobile OTP</label>
                <input type="text" required maxLength={6} value={staffOtpVerify.mobileOtp} onChange={e => setStaffOtpVerify({...staffOtpVerify, mobileOtp: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-center font-mono tracking-widest text-lg" placeholder="000000" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email OTP</label>
                <input type="text" required maxLength={6} value={staffOtpVerify.emailOtp} onChange={e => setStaffOtpVerify({...staffOtpVerify, emailOtp: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-center font-mono tracking-widest text-lg" placeholder="000000" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={() => setStaffProvisionStep(1)} className="px-6 py-4 rounded-xl font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">Back</button>
              <button type="submit" disabled={isStaffLoading} className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex justify-center">
                {isStaffLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Verify & Continue"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: PROVISION STAFF */}
        {staffProvisionStep === 3 && (
          <form onSubmit={handleProvisionStaff} className="space-y-5 animate-in slide-in-from-right-4">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900">Staff Details</h3>
              <p className="text-slate-500 text-sm">Step 3: Contact verified. Complete staff profile.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Full Legal Name</label>
              <input type="text" required value={staffForm.fullName} onChange={e => setStaffForm({...staffForm, fullName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Government ID (12-Digit)</label>
              <input type="text" required maxLength={12} value={staffForm.aadharNumber} onChange={e => setStaffForm({...staffForm, aadharNumber: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest" placeholder="123412341234" />
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={handleResetStaffProvisioning} className="px-6 py-4 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancel</button>
              <button type="submit" disabled={isStaffLoading} className="flex-1 bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md flex justify-center">
                {isStaffLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Provision Teller"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}