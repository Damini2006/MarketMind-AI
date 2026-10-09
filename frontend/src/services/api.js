import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "/api";

// Origin that serves user-uploaded files (/uploads/...) — derived from the
// API base so it stays correct when VITE_API_BASE_URL is overridden.
export const STATIC_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s — AI endpoints need time on cold Neon
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // browser sends the httpOnly session cookie automatically
});

// Auth is now transported by the httpOnly `marketmind_session` cookie set by
// the server on login/register. The browser attaches it to every same-site
// request (including the WebSocket handshake) without JavaScript ever seeing
// the raw token, so an XSS payload cannot steal a session.

// Double-submit CSRF: the server also sets a NON-httpOnly `marketmind_csrf`
// cookie (same value the server generated). Our page JS reads it here and
// sends it back in the X-CSRF-Token header. A cross-site page cannot read the
// cookie (same-origin rule) and therefore cannot set the header, so its
// requests fail the server-side match. SameSite=Lax stops the cookie from even
// being sent on cross-site sub-requests in the first place.
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match[2] : '';
}

api.interceptors.request.use(
  (config) => {
    const csrf = getCookie('marketmind_csrf');
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Silent session refresh ---
// Access tokens are short-lived (3h by default); the long-lived refresh token
// lives in an httpOnly cookie scoped to /api/auth, so when a request 401s we
// ask the server to rotate it and retry once. All concurrent 401s share a
// single in-flight refresh (otherwise N parallel requests would rotate N times
// and trip the server's reuse detection).
let refreshInFlight = null;

const isAuthUrl = (url = "") =>
  url.includes("/auth/login") ||
  url.includes("/auth/register") ||
  url.includes("/auth/refresh");

function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true } // plain axios: no api interceptors, no GET cache
      )
      .then((res) => res.data)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function bounceToLogin() {
  // The session cookie is httpOnly so JS cannot delete it, but a failed
  // refresh means the server already considers it dead; a fresh login
  // re-issues it. Clear the (non-secret) cached profile either way.
  localStorage.removeItem("marketmind_user");
  sessionStorage.removeItem("marketmind_user");
  if (window.location.pathname !== "/login") window.location.href = "/login";
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    const status = error.response?.status;

    if (status === 401 && config && !config._retried) {
      // Login/register failures belong to the AuthContext handler (it shows
      // the message); everything else gets one silent refresh attempt.
      if (isAuthUrl(config.url)) {
        if (config.url.includes("/auth/login")) return Promise.reject(error);
      } else {
        config._retried = true;
        try {
          await refreshSession();
          return api(config); // re-runs interceptors → fresh CSRF header/cookie
        } catch (refreshError) {
          bounceToLogin();
          return Promise.reject(error);
        }
      }
    }

    if (status === 401 && config && !isAuthUrl(config.url)) bounceToLogin();

    if (import.meta.env.DEV) {
      console.error(
        `[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → `,
        error.response?.status,
        error.response?.data || error.message
      );
    }
    return Promise.reject(error);
  }
);

// --- Session GET cache ---
// Pages re-fetch their data on every mount; this cache makes revisits render
// instantly while staying fresh within a short TTL. Any mutation (POST/PUT/
// PATCH/DELETE) busts the whole cache, so refresh-after-create still fetches
// the new row. Notifications are excluded so the bell stays live.
const GET_CACHE_TTL = 120_000; // 2 min — fewer Neon round-trips
const getCache = new Map();

const cacheKey = (config) => {
  const params = config.params ? JSON.stringify(config.params) : "";
  return `${config.method}:${config.url}?${params}`;
};

const isCacheable = (config) =>
  config.method === "get" && !config.url.includes("/notifications");

const rawAdapter = api.defaults.adapter;
const networkAdapter = axios.getAdapter(rawAdapter);

// Concurrent identical GETs share one network call (e.g. a background
// prefetch racing with the page's own fetch right after login).
const inflight = new Map();

api.defaults.adapter = async (config) => {
  const key = cacheKey(config);
  if (isCacheable(config)) {
    const hit = getCache.get(key);
    if (hit && Date.now() - hit.ts < GET_CACHE_TTL) {
      return {
        data: hit.data,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        request: {},
      };
    }
    const pending = inflight.get(key);
    if (pending) return pending;
  } else if (config.method !== "get") {
    getCache.clear();
  }

  const promise = networkAdapter(config)
    .then((response) => {
      if (isCacheable(config) && response.status >= 200 && response.status < 300) {
        getCache.set(key, { ts: Date.now(), data: response.data });
      }
      return response;
    })
    .finally(() => {
      if (isCacheable(config)) inflight.delete(key);
    });

  if (isCacheable(config)) inflight.set(key, promise);
  return promise;
};

// --- Auth & Profile ---
export const login = (data) => api.post("/auth/login", data);
export const register = (data) => api.post("/auth/register", data);
export const getMe = () => api.get("/auth/me");
export const updateProfile = (data) => api.put("/auth/profile", data);
export const changePassword = (data) => api.put("/auth/change-password", data);

// --- OTP Password Reset ---
export const sendOTP = (email) => api.post("/auth/send-otp", { email });
export const resetPasswordOTP = (email, otp, newPassword) =>
  api.post("/auth/reset-password-otp", {
    email,
    otp,
    new_password: newPassword,
  });

// --- Sales ---
export const getSales = () => api.get("/sales/");
export const createSale = (data) => api.post("/sales/", data);
export const uploadSalesCSV = (formData) =>
  api.post("/sales/upload-csv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

// --- Inventory & Products ---
export const getProducts = () => api.get("/inventory/products");
export const createProduct = (data) => api.post("/inventory/products", data);
export const updateStock = (productId, delta) =>
  api.patch(`/inventory/products/${productId}/stock`, { quantity_delta: delta });
export const getInventoryAlerts = () => api.get("/inventory/alerts");

// --- Customers ---
export const getCustomers = () => api.get("/customers/");
export const createCustomer = (data) => api.post("/customers/", data);

// --- Invoices ---
export const getInvoices = () => api.get("/invoices/");
export const createInvoice = (data) => api.post("/invoices/", data);
export const updateInvoiceStatus = (id, status) =>
  api.patch(`/invoices/${id}/status`, { status });

// --- Other list pages (prefetched so every page renders instantly) ---
export const getCategories = () => api.get("/categories/");
export const getSuppliers = () => api.get("/suppliers/");
export const getDatasets = () => api.get("/datasets/");
export const getTeamMembers = () => api.get("/users/");

// --- AI Analytics ---
export const getKPIs = () => api.get("/analytics/kpis");
export const getForecast = (days = 30) => api.get(`/ai/forecast?days=${days}`);
export const getSegmentation = () => api.get("/ai/segmentation");
export const getChurnRisk = () => api.get("/ai/churn-risk");
export const getRecommendations = () => api.get("/ai/recommendations");
export const getAnomalies = () => api.get("/ai/anomalies");

export default api;