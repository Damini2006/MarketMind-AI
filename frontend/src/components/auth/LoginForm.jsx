import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "../../assets/images/logo.png";
import useAuth from "../../context/useAuth";
import "../../styles/auth.css";

const API_URL = "http://127.0.0.1:8000";

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!role) {
    setError("Please select your role.");
    return;
  }

    // Email Validation
    const emailRule =
      /^[a-zA-Z0-9]+([._-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;
    // Password Validation
    const passwordRule =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$%^&*!_\-+=])[A-Za-z\d@#$%^&*!_\-+=]{8,}$/;

    if (!emailRule.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!passwordRule.test(password)) {
      setError(
        "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character."
      );
      return;
    }

    try {
      setLoading(true);

      // Send login request to FastAPI
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      // Handle backend error
      if (!response.ok) {
        setError(data.detail || "Login failed. Please check your email and password.");
        return;
      }

      // Backend returns: { token: "...", token_type: "bearer", user: {...} }
      login(data);
      navigate("/dashboard");

    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to connect to the server. Please make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

    return (
    <div className="auth-card">
      {/* Logo */}
      <div className="logo">
        <img src={logo} alt="MarketMind AI Logo" />
      </div>

      <h1>Welcome Back</h1>

      <p className="subtitle">
        Sign in to continue to <strong>MarketMind AI</strong>
      </p>

      {/* Error Message */}
      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* Email */}
        <label>Email</label>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          maxLength="50"
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {/* Password */}
        <label>Password</label>

        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            minLength="8"
            maxLength="20"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        {/* Role */}
        <label>Sign in as</label>
        <select
          className="role-select"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="">Choose your role</option>
          <option value="Business Owner">Business Owner</option>
          <option value="Store Manager">Store Manager</option>
          <option value="Sales Executive">Sales Executive</option>
          <option value="Administrator">Administrator</option>
        </select>

        {/* Remember Me + Forgot Password */}
        <div className="auth-options">
          <label className="remember-me">
            <input type="checkbox" />
            Remember Me
          </label>

          <Link to="#">Forgot Password?</Link>
        </div>

        {/* Login Button */}
        <button
          className="auth-btn"
          type="submit"
          disabled={loading}
        >
          {loading ? "Signing In..." : "Sign In"}
        </button>
      </form>

      <p className="bottom-text">
        Don't have an account?{" "}
        <Link to="/register">Create one</Link>
      </p>
    </div>
  );
}

export default LoginForm;