import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, Sparkles, CheckCircle2, Eye, EyeOff } from "lucide-react";
import api from "../services/api.js";
import { ErrorBanner } from "../components/ui.jsx";

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "sales_executive",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      setSuccessMsg("Account registered successfully! Redirecting to login...");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Registration failed. Please check your information."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2e2b8f] dark:bg-slate-950 p-4 md:p-6 font-sans transition-colors duration-300">
      <div className="w-full max-w-5xl grid md:grid-cols-12 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-white/10 dark:border-slate-800 transition-colors duration-300">
        
        {/* Branding Panel */}
        <div className="hidden md:flex md:col-span-5 flex-col justify-between bg-[#2e2b8f] dark:bg-slate-900 text-white p-10 relative overflow-hidden dark:border-r dark:border-slate-800">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-brand-200 text-xs font-semibold mb-6">
              <Sparkles size={14} className="text-amber-400" />
              <span>Get Started Free</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-3 leading-tight">
              Join MarketMind AI
            </h1>
            <p className="text-slate-300 dark:text-slate-400 text-sm leading-relaxed">
              Create your account to access real-time retail analytics, automated inventory tracking, and AI sales forecasts.
            </p>
          </div>

          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-300 dark:text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Automated Inventory Tracking</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 dark:text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Predictive Sales Analytics</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300 dark:text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>Role-based Access Management</span>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="mb-6">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Create Account
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter your details below to register your business profile.
            </p>
          </div>

          <ErrorBanner message={error} />

          {successMsg && (
            <div className="p-3 mb-4 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Account Role
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2e2b8f]/20 dark:focus:ring-indigo-500/30 focus:border-[#2e2b8f] dark:focus:border-indigo-500 transition-all"
              >
                <option value="business_owner">Business Owner</option>
                <option value="store_manager">Store Manager</option>
                <option value="sales_executive">Sales Executive</option>
                <option value="admin">System Administrator</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
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
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
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
              <span>{loading ? "Creating Account..." : "Create Account"}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-[#2e2b8f] dark:text-indigo-400 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}