import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

function RegisterForm() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] =
    useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    // Name validation
    const nameRule =
      /^[A-Za-z ]{3,30}$/;

    // Email validation
    const emailRule =
      /^[a-zA-Z0-9]+([._-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

    // Password validation
    const passwordRule =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$%^&*!_\-+=])[A-Za-z\d@#$%^&*!_\-+=]{8,}$/;

    if (!nameRule.test(name)) {
      setError(
        "Name should contain only letters and minimum 3 characters."
      );
      return;
    }

    if (!emailRule.test(email)) {
      setError(
        "Please enter a valid email address."
      );
      return;
    }

    if (!passwordRule.test(password)) {
      setError(
        "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    try {
      setLoading(true);

      // Send registration request to FastAPI
      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name,
            email: email,
            password: password,
          }),
        }
      );

      const data = await response.json();

      // Handle backend error
      if (!response.ok) {
        setError(
          data.detail ||
            "Registration failed. Please try again."
        );
        return;
      }

      // Registration successful
      alert(
        "Account created successfully. Please login."
      );

      // Clear form
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");

      // Navigate to login
      navigate("/");

    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      setError(
        "Unable to connect to the server. Please make sure the backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">

      <h1>
        Create Account
      </h1>

      <p className="subtitle">
        Join MarketMind AI
      </p>

      {/* Error Message */}
      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* Name */}
        <label>
          Name
        </label>

        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          maxLength="30"
          onChange={(e) =>
            setName(e.target.value)
          }
          required
        />

        {/* Email */}
        <label>
          Email
        </label>

        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          maxLength="50"
          onChange={(e) =>
            setEmail(e.target.value)
          }
          required
        />

        {/* Password */}
        <label>
          Password
        </label>

        <div className="password-field">

          <input
            type={
              showPassword
                ? "text"
                : "password"
            }
            placeholder="Create password"
            value={password}
            minLength="8"
            maxLength="20"
            onChange={(e) =>
              setPassword(e.target.value)
            }
            required
          />

          <button
            type="button"
            className="toggle-password"
            onClick={() =>
              setShowPassword(
                !showPassword
              )
            }
          >
            {showPassword
              ? "Hide"
              : "Show"}
          </button>

        </div>

        {/* Confirm Password */}
        <label>
          Confirm Password
        </label>

        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) =>
            setConfirmPassword(
              e.target.value
            )
          }
          required
        />

        {/* Register Button */}
        <button
          className="auth-btn"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Creating Account..."
            : "Register"}
        </button>

      </form>

      <p className="bottom-text">
        Already have an account?{" "}

        <Link to="/">
          Login
        </Link>
      </p>

    </div>
  );
}

export default RegisterForm;