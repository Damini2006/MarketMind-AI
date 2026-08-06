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
    // Surface the real problem in dev instead of a silent failure
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

export default api;