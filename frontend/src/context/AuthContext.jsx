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

// Warm the frontend GET cache with every list page's data so they all render
// instantly right after login or a page refresh — no spinner on first visit.
// Fire-and-forget: results land in the axios cache, no state touched here.
// The team list is role-restricted (owner/admin), so only prefetch it for
// roles that can actually open the Team page.
const TEAM_ROLES = ['business_owner', 'admin'];

const prefetchCore = (role) => {
  Promise.allSettled([
    getKPIs(),
    getSales(),
    getCustomers(),
    getProducts(),
    getInvoices(),
    getCategories(),
    getSuppliers(),
    getDatasets(),
    TEAM_ROLES.includes(role) ? getTeamMembers() : Promise.resolve(),
    getInventoryAlerts(),
  ]);
};

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

  // On boot with a stored token (page refresh), prefetch the core data so the
  // dashboard is already warm when the app renders.
  useEffect(() => {
    if (localStorage.getItem("marketmind_token")) {
      const raw = localStorage.getItem("marketmind_user");
      const bootUser = raw ? JSON.parse(raw) : null;
      prefetchCore(bootUser?.role);
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

      localStorage.setItem("marketmind_token", res.data.access_token);
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
    // Clear tokens and stored user data
    localStorage.removeItem("marketmind_token");
    localStorage.removeItem("marketmind_user");
    sessionStorage.removeItem("marketmind_token");
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