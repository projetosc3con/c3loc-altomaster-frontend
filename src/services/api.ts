import axios from 'axios';
import { supabase } from '../lib/supabase';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_ADDRESS,
});

// Request interceptor to add and proactively refresh the JWT token
api.interceptors.request.use(async (config) => {
  try {
    let { data: { session } } = await supabase.auth.getSession();

    // Proactively refresh token if expired or expiring within 60 seconds
    if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        session = data.session;
      }
    }

    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn('Erro ao obter sessão no interceptor do Axios:', err);
  }

  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor to handle token expiration (401) and auto-retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const {
          data: { session },
          error: refreshError,
        } = await supabase.auth.refreshSession();

        if (!refreshError && session?.access_token) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        console.error('[API] Falha ao renovar token de autenticação:', refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
