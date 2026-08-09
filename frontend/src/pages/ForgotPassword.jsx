import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, KeyRound, Sparkles, CheckCircle2, ArrowRight, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { sendOTP, resetPasswordOTP } from "../services/api.js";
import { ErrorBanner } from "../components/ui.jsx";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      const res = await sendOTP(email);
      setSuccessMsg(res.data?.message || `A 6-digit OTP has been sent to ${email}`);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP. Please check your email.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      const res = await resetPasswordOTP(email, otp, newPassword);
      setSuccessMsg(res.data?.message || "Password reset successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToStepOne = () => {
    setError("");
    setSuccessMsg("");
    setStep(1);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2e2b8f] dark:bg-slate-950 p-4 md:p-6 font-sans transition-colors duration-300">
      <div className="w-full max-w-5xl grid md:grid-cols-12 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 dark:border-slate-800 transition-colors duration-300">
        
        {/* Branding Panel */}
        <div className="hidden md:flex md:col-span-5 flex-col justify-between bg-[#2e2b8f] dark:bg-slate-900 text-white p-10 relative overflow-hidden dark:border-r dark:border-slate-800">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-brand-200 text-xs font-semibold mb-6">
              <Sparkles size={14} className="text-amber-400" />
              <span>Account Recovery</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight">
              Reset Password
            </h1>
            <p className="text-slate-300 dark:text-slate-400 text-sm leading-relaxed">
              Verify your email via a secure one-time passcode (OTP) to restore access to MarketMind AI.
            </p>
          </div>

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 dark:text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Instant OTP Verification</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 dark:text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Secure Password Encryption</span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="mb-6">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {step === 1 ? "Forgot Password?" : "Enter OTP & New Password"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {step === 1
                ? "Enter your registered email address to receive an OTP code."
                : "Enter the code sent to your email along with your new password."}
            </p>
          </div>

          <ErrorBanner message={error} />

          {successMsg && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-[#2e2b8f] hover:bg-[#252275] active:bg-[#1d1a5c] dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-[#2e2b8f]/20 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{loading ? "Sending OTP..." : "Send Reset OTP"}</span>
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  6-Digit OTP Code
                </label>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 font-mono tracking-widest focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                    placeholder="123456"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleBackToStepOne}
                  className="py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-1"
                >
                  <ArrowLeft size={16} />
                  <span>Resend</span>
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-[#2e2b8f] hover:bg-[#252275] active:bg-[#1d1a5c] dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-[#2e2b8f]/20 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{loading ? "Resetting Password..." : "Reset Password"}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </div>
            </form>
          )}

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            Remembered your password?{" "}
            <Link to="/login" className="text-[#2e2b8f] dark:text-indigo-400 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}