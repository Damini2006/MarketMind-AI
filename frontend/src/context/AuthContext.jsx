import  { createContext, useContext, useState, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => {
    const raw = localStorage.getItem("marketmind_user");
    return raw ? JSON.parse(raw) : null;
  });

  // Wrap setUser so any update (e.g. from Settings after a profile edit)
  // also persists to localStorage, keeping state and storage in sync.
  const setUser = useCallback((updater) => {
    setUserState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next) {
        localStorage.setItem("marketmind_user", JSON.stringify(next));
      } else {
        localStorage.removeItem("marketmind_user");
      }
      return next;
    });
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("marketmind_token", res.data.access_token);
      localStorage.setItem(
        "marketmind_user",
        JSON.stringify(res.data.user)
      );

      setUser(res.data.user);

      return true;
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setLoading(true);
    setError(null);

    try {
      await api.post("/auth/register", payload);
      return true;
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("marketmind_token");
    localStorage.removeItem("marketmind_user");
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (...roles) => !!user && roles.includes(user.role),
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        login,
        register,
        logout,
        loading,
        error,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}