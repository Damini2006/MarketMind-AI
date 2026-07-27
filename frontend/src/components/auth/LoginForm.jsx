import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "../../assets/images/logo.png";
import useAuth from "../../context/useAuth";
function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const handleSubmit = (e) => {

    e.preventDefault();

// Email Validation

    const emailRule =
      /^[a-zA-Z0-9]+([._-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9]+([.-]?[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$/;

    // Password Validation

    const passwordRule =
      /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@#$%^&*!_\-+=])[A-Za-z\d@#$%^&*!_\-+=]{8,}$/;

    if (!emailRule.test(email)) {


      alert("Please enter a valid email address");

      return;


    }

    if (!passwordRule.test(password)) {

      alert(
        "Password must contain:\n\n" +
        "✔ Minimum 8 characters\n" +
        "✔ One uppercase letter\n" +
        "✔ One lowercase letter\n" +
        "✔ One number\n" +
        "✔ One special character\n" +
        "✔ No spaces"
      );


      return;

    }

    // Get registered users

    const users = JSON.parse(

      localStorage.getItem("users")

    ) || [];
    // Check account exists

    const existingUser = users.find(

      (user) =>

        user.email === email &&

        user.password === password

    );
    if (!existingUser) {
      alert(
        "Account not found or incorrect password. Please register first."
      );


      return;

    }
    // Save logged in user

    login({

      name: existingUser.name,

      email: existingUser.email

    });

    alert("Login Successful");



    // Go to dashboard

    navigate("/dashboard");

  };

  return (

    <div className="auth-card">

      {/* Logo */}

      <div className="logo">

        <img

          src={logo}

          alt="MarketMind AI Logo"

        />

      </div>
      <h1>
        Welcome Back
      </h1>

      <p className="subtitle">

        Sign in to continue to <strong>MarketMind AI</strong>

      </p>

      <form onSubmit={handleSubmit}>


        {/* Email */}


        <label>
          Email
        </label>

        <input
          type="email"

          placeholder="Enter your email"

          value={email}

          maxLength="50"

          onChange={(e)=>setEmail(e.target.value)}

          required
        />
        {/* Password */}

        <label>
          Password
        </label>

        <div className="password-field">

          <input
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            minLength="8"
            maxLength="20"
            onChange={(e)=>setPassword(e.target.value)}
            required

          />

          <button
            type="button"
            className="toggle-password"

            onClick={() =>
              setShowPassword(!showPassword)
            }

          >

            {showPassword ? "Hide" : "Show"}
          </button>

        </div>

        {/* Remember Me + Forgot Password */}

        <div className="auth-options">

          <label className="remember-me">
            <input
              type="checkbox"
            />
            Remember Me
          </label>

          <Link to="#">

            Forgot Password?

          </Link>
        </div>

        <button

          className="auth-btn"

          type="submit"
        >
          Sign In
        </button>
      </form>
      <p className="bottom-text">
        Don't have an account?{" "}
        <Link to="/register">
          Create one
        </Link>
      </p>
    </div>
  );
}
export default LoginForm;