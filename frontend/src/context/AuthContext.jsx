import { createContext, useContext, useState, useCallback, useEffect } from "react";
import api, {
  getKPIs,
  getSales,
  getCustomers,
  getProducts,
  getInvoices,
  getCategories,
  getSuppliers,
  getDatasets,
  getTeamMembers,
  getInventoryAlerts,
} from "../services/api";

const AuthContext = createContext(null);

// Only prefetch KPIs on boot — the most critical dashboard data.
// Other pages lazy-load their data when navigated to, cutting boot time
// from 10+ sequential Neon round-trips to just 1.
const prefetchCore = (role) => {
  Promise.allSettled([getKPIs()]);
};

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => {
    const raw = localStorage.getItem("marketmind_user");
    return raw ? JSON.parse(raw) : null;
  });

  // Keep the cached user profile in sync with storage so a page refresh
  // restores the display identity. The real session (JWT) lives in an
  // httpOnly cookie that JS cannot read, so this is NOT the auth token.
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

  // On boot with a cached user profile, prefetch the core data so the
  // dashboard is already warm when the app renders. The real session (JWT)
  // lives in an httpOnly cookie; if it has expired the first API call will
  // 401 and the axios interceptor bounces the user back to /login.
  useEffect(() => {
    const raw = localStorage.getItem("marketmind_user");
    if (raw) {
      const bootUser = JSON.parse(raw);
      prefetchCore(bootUser.role);
    }
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

      // The server sets the httpOnly marketmind_session cookie on the response;
      // the browser stores it automatically and sends it on every subsequent
      // same-site request. We keep only the non-secret user profile in storage
      // for display/re-render purposes.
      localStorage.setItem(
        "marketmind_user",
        JSON.stringify(res.data.user)
      );

      setUser(res.data.user);

      // Prime the cache before navigating to the dashboard.
      prefetchCore(res.data.user.role);

      return true;
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [setUser]);

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
    // Ask the server to clear the httpOnly session cookie. The request is
    // fire-and-forget with keepalive so it can finish even though we navigate
    // away immediately after; without it the cookie would remain valid until
    // expiry and a back-button revisit would silently re-authenticate.
    fetch("/api/auth/logout", {
      method: "POST",
      keepalive: true,
      credentials: "include",
    }).catch(() => {});

    localStorage.removeItem("marketmind_user");
    sessionStorage.removeItem("marketmind_user");
    setUser(null);

    // Hard redirect to landing page to completely clear application state
    window.location.href = "/";
  }, [setUser]);

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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
