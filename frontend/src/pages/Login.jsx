import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, Sparkles, CheckCircle2, ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { ErrorBanner } from "../components/ui.jsx";
import AnimateShape from "../components/AnimateShape.jsx"; // Import the 3D visual component

export default function Login() {
  const { login, loading, error } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(email, password, rememberMe);
    if (ok) {
      navigate("/dashboard");
    }
  };

  const togglePasswordVisibility = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword((prev) => !prev);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-[#2e2b8f] dark:bg-slate-950 p-4 md:p-6 font-sans transition-colors duration-300 relative overflow-hidden">
      
      {/* Background Page Glows & Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute -top-[30%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-400/30 via-purple-500/20 to-transparent blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-blue-400/30 via-indigo-600/20 to-transparent blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      {/* Top spacing element to center the card nicely */}
      <div className="w-full" />

      {/* Main Container Card */}
      <div className="w-full max-w-5xl grid md:grid-cols-12 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 dark:border-slate-800 transition-colors duration-300 relative z-10 my-auto">
        
        {/* Branding Panel with 3D Background */}
        <div className="hidden md:flex md:col-span-5 flex-col justify-between bg-[#2e2b8f] dark:bg-slate-900 text-white p-10 relative overflow-hidden dark:border-r dark:border-slate-800">
          
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* 3D Interactive Visual Canvas */}
          <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen pointer-events-none">
            <AnimateShape />
          </div>

          {/* Content Layer (z-10 ensures it stays above the canvas) */}
          <div className="relative z-10 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-brand-200 text-xs font-semibold mb-6 shadow-inner">
              <Sparkles size={14} className="text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Welcome Back</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight drop-shadow-sm">
              MarketMind AI
            </h1>
            <p className="text-slate-200 dark:text-slate-300 text-sm leading-relaxed font-medium">
              AI-powered sales intelligence platform designed for retail stores, supermarkets, and small businesses.
            </p>
          </div>

          <div className="relative z-10 pointer-events-none space-y-3 p-4 rounded-2xl bg-black/20 backdrop-blur-md border border-white/10 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Smart Sales Analytics</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Inventory Management</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-200 font-medium">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>Customer Insights & Reports</span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="mb-6">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Sign In
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter your credentials to access your account.
            </p>
          </div>

          <ErrorBanner message={error} />

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-12 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none p-1 z-10"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[#2e2b8f] dark:bg-slate-800 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30"
                />
                Remember me
              </label>

              <Link
                to="/forgot-password"
                className="text-xs text-[#2e2b8f] dark:text-indigo-400 font-bold hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-[#2e2b8f] hover:bg-[#252275] active:bg-[#1d1a5c] dark:bg-indigo-600 dark:hover:bg-indigo-500 dark:active:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-[#2e2b8f]/20 dark:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{loading ? "Signing in..." : "Sign In"}</span>
              {!loading && <ArrowRight size={16} />}
            </button>

          </form>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            New business?{" "}
            <Link to="/register" className="text-[#2e2b8f] dark:text-indigo-400 font-bold hover:underline">
              Create an account
            </Link>
          </p>

        </div>
      </div>

      {/* Landing Page Style Footer (Kept at last) */}
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