import axios from 'axios';
import { refreshAccessToken } from './authApi';

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

axiosClient.interceptors.response.use(
  (response) => {
    // If the call succeeds, just pass the response through
    return response;
  },
  async(error) =>{
    // grab the original req config that jsut failed 
    const originalRequest = error.config;

    // check if the error is 401 (Unauthorized) AND that we haven't already retried this 
    if (error.response?.status == 401 && !originalRequest._retry) {
      
      // Mark this request as retried so we don't end up in an infinit loop 
      originalRequest._retry = true;

      try{
        // attempt to get new token from the backend
        const data = await refreshAccessToken();

        // C# endpoints typically return {token, refreshToken} or {accessToken, refreshToken}
        const newAccessToken = data.token || data.accessToken;
        const newRefreshToken = data.refreshToken;

        // save the new keys to the browser's backpack
        localStorage.setItem('accessToken', newAccessToken);
        if(newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);

        // Update the failed reques's Authorization header with shiny new token 
        originalRequest.header.Authorization = 'Bearer ${newAccessToken}';

        // Retry the exact same request usinng the updated configuration!
        return axiosClient(originalRequest);
      }
      catch(refreshError){
        // if ther refresh token is also expired or invalid, we must force a hard logout
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');

        // Because Axios is outside the React component tree, we can't use useNavigate()
        // we do a hard window redirect  to clear React's memory and send them to logic page 
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }

    // if its not a 401, or if it failed AFTER a retry reject it back to the component 
    return Promise.reject(error);

  }
);

export default axiosClient;
