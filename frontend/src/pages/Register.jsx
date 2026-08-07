import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ErrorBanner } from "../components/ui";



export default function Register() {
  const { register, loading, error } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    full_name: "",
    email: "",
    password: "",
  });

  const [success, setSuccess] = useState(false);

  const handleChange = (e) =>
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const ok = await register(form);

    if (ok) {
      setSuccess(true);

      setTimeout(() => {
        navigate("/login");
      }, 1200);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold mb-1">Create an account</h2>

        <p className="text-slate-500 text-sm mb-6">
          Join MarketMind AI to start managing your business.
        </p>

        <ErrorBanner message={error} />

        {success && (
          <div className="bg-green-100 text-green-700 p-3 rounded-lg mb-4">
            Account created successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label>Company Name</label>
            <input
              className="input mt-1"
              name="company_name"
              value={form.company_name}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label>Full Name</label>
            <input
              className="input mt-1"
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label>Email</label>

            <input
              type="email"
              className="input mt-1"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label>Password</label>

            <div className="relative mt-1">
              <input
                type={showPassword ? "text" : "password"}
                className="input pr-10"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>



          <button className="btn-primary w-full" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center">
          Already have an account?{" "}
          <Link className="text-brand-600" to="/login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}