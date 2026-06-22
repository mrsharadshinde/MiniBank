import axios from 'axios';
import { refreshAccessToken } from './authApi';
import { ENV } from '../env';

// 1. Create a custom instance of Axios
const axiosClient = axios.create({
  baseURL: ENV.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. The Request Interceptor (Frontend Middleware)
axiosClient.interceptors.request.use(
  (config) => {
    
    if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLocaleLowerCase() || '') ) {

      const csrfCookie = document.cookie
        .split(';')
        .map(c => c.trim())
        .find(row => row.startsWith('XSRF-TOKEN='));

      if(csrfCookie) {
        const csrfToken = csrfCookie.split('=')[1];
        config.headers['X-XSRF-TOKEN'] = decodeURIComponent(csrfToken);
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
  );


axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if the server returned an Unauthorized 401 response 
    if (error.response?.status == 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try{
        // Ther efresh endpoint must also send/receive cookies automatically 
        await axiosClient.post('/api/auth/refresh-token');

        // retry the initial request using hte valid updated session cookies 
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Session Completly dead -> Bounce back to authentication wall 
        window.location.href = '/'
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
