import axios from 'axios';

// 1. Create a custom instance of Axios
const axiosClient = axios.create({
  baseURL: 'http://localhost:5131', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. The Request Interceptor (Frontend Middleware)
axiosClient.interceptors.request.use(
  (config) => {
    
    // Look inside the browser's memory for the JWT token
    const token = localStorage.getItem('accessToken');

    // If a token exists, attach it to the headers securely
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    // If something goes fundamentally wrong before sending, reject it
    return Promise.reject(error);
  }
);

// 3. Export the client for use in our app
export default axiosClient;