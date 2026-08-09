import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("marketmind_token") ||
      sessionStorage.getItem("marketmind_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("marketmind_token");
      localStorage.removeItem("marketmind_user");
      sessionStorage.removeItem("marketmind_token");
      sessionStorage.removeItem("marketmind_user");
    }
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

// --- AI Analytics ---
export const getKPIs = () => api.get("/analytics/kpis");
export const getForecast = (days = 30) => api.get(`/ai/forecast?days=${days}`);
export const getSegmentation = () => api.get("/ai/segmentation");
export const getChurnRisk = () => api.get("/ai/churn-risk");
export const getRecommendations = () => api.get("/ai/recommendations");
export const getAnomalies = () => api.get("/ai/anomalies");

export default api;