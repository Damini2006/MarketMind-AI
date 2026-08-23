import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, User, Building2, ArrowRight, Sparkles, CheckCircle2, Eye, EyeOff, ShieldCheck, Crown, Briefcase, UserCheck, Shield } from "lucide-react";
import api from "../services/api.js";
import { ErrorBanner } from "../components/ui.jsx";
import AnimateShape from "../components/AnimateShape.jsx";

const ROLES = [
  { value: 'business_owner', label: 'Business Owner', icon: Crown, color: 'amber' },
  { value: 'store_manager', label: 'Store Manager', icon: Briefcase, color: 'blue' },
  { value: 'sales_executive', label: 'Sales Executive', icon: UserCheck, color: 'emerald' },
  { value: 'admin', label: 'Admin', icon: Shield, color: 'purple' },
];

const ROLE_PERMISSIONS = {
  business_owner: ['Dashboard', 'Sales', 'Inventory', 'Invoices', 'Customers', 'Categories', 'Suppliers', 'Team', 'Datasets', 'Forecasting', 'Churn', 'Anomalies', 'Recommendations', 'Segmentation', 'Settings'],
  store_manager: ['Dashboard', 'Sales', 'Inventory', 'Invoices', 'Customers', 'Categories', 'Suppliers', 'Forecasting', 'Churn', 'Anomalies', 'Recommendations', 'Segmentation', 'Settings'],
  sales_executive: ['Dashboard', 'Sales', 'Inventory', 'Invoices', 'Customers', 'Segmentation', 'Recommendations', 'Settings'],
  admin: ['Dashboard', 'Sales', 'Inventory', 'Invoices', 'Customers', 'Categories', 'Suppliers', 'Team', 'Datasets', 'Forecasting', 'Churn', 'Anomalies', 'Recommendations', 'Segmentation', 'Settings'],
};

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    company_name: "", name: "", email: "", role: "business_owner", password: "", confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const togglePassword = (e) => { e.preventDefault(); e.stopPropagation(); setShowPassword(p => !p); };
  const toggleConfirmPassword = (e) => { e.preventDefault(); e.stopPropagation(); setShowConfirmPassword(p => !p); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setSuccessMsg("");
    if (formData.password !== formData.confirmPassword) { setError("Passwords do not match."); return; }
    if (formData.password.length < 6) { setError("Password must be at least 6 characters long."); return; }
    setLoading(true);
    try {
      await api.post("/auth/register", {
        company_name: formData.company_name, name: formData.name,
        email: formData.email, role: formData.role, password: formData.password,
      });
      setSuccessMsg("Account registered successfully! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Please check your information.");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all";

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-[#2e2b8f] dark:bg-slate-950 p-4 md:p-6 font-sans transition-colors duration-300 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute -top-[30%] -left-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-indigo-400/30 via-purple-500/20 to-transparent blur-[120px] animate-pulse" />
        <div className="absolute -bottom-[30%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-tl from-blue-400/30 via-indigo-600/20 to-transparent blur-[120px] animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <div className="w-full" />

      {/* Main Card */}
      <div className="w-full max-w-5xl grid md:grid-cols-12 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 dark:border-slate-800 transition-colors duration-300 relative z-10 my-auto">
        
        {/* Branding Panel */}
        <div className="hidden md:flex md:col-span-5 flex-col justify-between bg-[#2e2b8f] dark:bg-slate-900 text-white p-8 relative overflow-hidden dark:border-r dark:border-slate-800">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px] pointer-events-none" />
          <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen pointer-events-none"><AnimateShape /></div>
          <div className="relative z-10 pointer-events-none">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs font-semibold mb-4">
              <Sparkles size={12} className="text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span>Get Started Free</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-2">Join MarketMind AI</h1>
            <p className="text-slate-200 text-xs leading-relaxed">Access real-time retail analytics, automated inventory, and AI forecasts.</p>
          </div>
          <div className="relative z-10 pointer-events-none space-y-2 p-3 rounded-xl bg-black/20 backdrop-blur-md border border-white/10">
            {['Automated Inventory Tracking', 'Predictive Sales Analytics', 'Role-based Access'].map(t => (
              <div key={t} className="flex items-center gap-2 text-[11px] text-slate-200">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" /><span>{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="md:col-span-7 p-5 md:p-6 flex flex-col justify-center bg-white dark:bg-slate-900">
          <div className="mb-3">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Create Account</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enter your details to register.</p>
          </div>

          <ErrorBanner message={error} />
          {successMsg && (
            <div className="p-2 mb-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2">
              <CheckCircle2 size={14} /><span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2.5">
            {/* Company + Name row */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Company</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type="text" name="company_name" required value={formData.company_name} onChange={handleChange} className={inputCls} placeholder="Mega Mart" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type="text" name="name" required value={formData.name} onChange={handleChange} className={inputCls} placeholder="John Doe" />
                </div>
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="email" name="email" required value={formData.email} onChange={handleChange} className={inputCls} placeholder="you@example.com" />
              </div>
            </div>

            {/* Role Picker */}
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Role</label>
              <div className="grid grid-cols-2 gap-1.5">
                {ROLES.map(({ value, label, icon: Icon }) => (
                  <button key={value} type="button" onClick={() => setFormData(p => ({ ...p, role: value }))}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
                      formData.role === value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}>
                    <Icon size={12} className="shrink-0" />
                    <span className="truncate">{label}</span>
                    {formData.role === value && <CheckCircle2 size={10} className="ml-auto shrink-0 text-indigo-500" />}
                  </button>
                ))}
              </div>
              {formData.role === 'admin' && <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-1">Requires admin invite.</p>}
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type={showPassword ? "text" : "password"} name="password" required value={formData.password} onChange={handleChange} className={inputCls} placeholder="••••••" />
                  <button type="button" onClick={togglePassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 z-10">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">Confirm</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" required value={formData.confirmPassword} onChange={handleChange} className={inputCls} placeholder="••••••" />
                  <button type="button" onClick={toggleConfirmPassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 z-10">
                    {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-[#2e2b8f] hover:bg-[#252275] dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all">
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
              {!loading && <ArrowRight size={14} />}
            </button>
          </form>

          <p className="text-center text-[11px] text-slate-500 dark:text-slate-400 mt-3">
            Already have an account? <Link to="/login" className="text-[#2e2b8f] dark:text-indigo-400 font-bold hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-5xl flex items-center justify-center text-[10px] text-indigo-200/70 dark:text-slate-500 py-2 relative z-10">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-indigo-300 dark:text-indigo-400" />
          <span>© 2026 MarketMind AI</span>
        </div>
      </footer>
    </div>
  );
}
