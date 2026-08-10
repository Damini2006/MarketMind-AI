import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, ArrowRight, Sparkles, CheckCircle2, Eye, EyeOff, ShieldCheck, KeyRound, ArrowLeft } from "lucide-react";
import api from "../services/api.js";
import { ErrorBanner } from "../components/ui.jsx";
import AnimateShape from "../components/AnimateShape.jsx";

export default function ForgotPassword() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1 = enter email, 2 = enter OTP + new password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email });
      setSuccessMsg("OTP sent to your email. It expires in 15 minutes.");
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password-otp", {
        email,
        otp,
        new_password: password,
      });
      setSuccessMsg("Password reset successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to reset password. Please check your OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    setStep(1);
    setError("");
    setSuccessMsg("");
  };

  const togglePassword = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword((prev) => !prev);
  };

  const toggleConfirmPassword = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowConfirmPassword((prev) => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-[#2e2b8f] dark:bg-slate-950 p-4 md:p-6 font-sans transition-colors duration-300 relative overflow-hidden">
      {/* Background Page Glows & Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute -top-[30%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-400/30 via-purple-500/20 to-transparent blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-blue-400/30 via-indigo-600/20 to-transparent blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <div className="w-full" />

      {/* Main Container Card */}
      <div className="w-full max-w-5xl grid md:grid-cols-12 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 dark:border-slate-800 transition-colors duration-300 relative z-10 my-auto">
        {/* Branding Panel */}
        <div className="hidden md:flex md:col-span-5 flex-col justify-between bg-[#2e2b8f] dark:bg-slate-900 text-white p-10 relative overflow-hidden dark:border-r dark:border-slate-800">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen pointer-events-none">
            <AnimateShape />
          </div>

          <div className="relative z-10 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-brand-200 text-xs font-semibold mb-6 shadow-inner">
              <Sparkles size={14} className="text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Password Reset</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight drop-shadow-sm">
              Reset Your Password
            </h1>
            <p className="text-slate-200 dark:text-slate-300 text-sm leading-relaxed font-medium">
              Enter the OTP code sent to your email to set a new password for your MarketMind AI account.
            </p>
          </div>

          <div className="relative z-10 pointer-events-none space-y-3 p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Secure OTP Authentication</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>15-minute OTP Validity</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>End-to-end Encrypted</span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white dark:bg-slate-900 transition-colors duration-300">
          {step === 1 ? (
            <>
              <div className="mb-6">
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  Reset Password
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Enter your registered email to receive a password reset OTP.
                </p>
              </div>

              <ErrorBanner message={error} />

              {successMsg && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
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
                  <span>{loading ? "Sending OTP..." : "Send OTP"}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6 flex items-center justify-center gap-1.5">
                <ArrowLeft size={14} />
                <Link to="/login" className="text-[#2e2b8f] dark:text-indigo-400 font-bold hover:underline">
                  Back to Sign in
                </Link>
              </p>
            </>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={handleGoBack}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 -ml-1"
                    title="Go back to email step"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    Enter OTP
                  </h2>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  A 6-digit code was sent to <span className="font-semibold text-slate-700 dark:text-slate-300">{email}</span>
                </p>
              </div>

              <ErrorBanner message={error} />

              {successMsg && (
                <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    OTP Code
                  </label>
                  <div className="relative">
                    <KeyRound size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all tracking-[0.5em] text-center font-mono text-lg"
                      placeholder="000000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={togglePassword}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none p-1 z-10"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={toggleConfirmPassword}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none p-1 z-10"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-[#2e2b8f] hover:bg-[#252275] active:bg-[#1d1a5c] dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-[#2e2b8f]/20 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{loading ? "Resetting Password..." : "Reset Password"}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
                <Link to="/login" className="text-[#2e2b8f] dark:text-indigo-400 font-bold hover:underline">
                  Back to Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between text-xs text-indigo-200/70 dark:text-slate-500 py-3 gap-2 relative z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-indigo-300 dark:text-indigo-400" />
          <span>© 2026 MarketMind AI. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <span>•</span>
          <a href="#" className="hover:text-white transition-colors">Support</a>
        </div>
      </footer>
    </div>
  );
}