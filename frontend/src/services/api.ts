import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { setBackdropLoading } from '../components/BackdropLoader';
import { showLogin } from '../components/login/LoginPrompt';



import { getUserManager, refreshAccessToken } from '@adolf94/ar-auth-client';

let isRefreshing = false;
let failedQueue = [];

// Utility function to process the waiting queue
const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token); // Resolve with the new token
    }
  });
  failedQueue = [];
};

export const getToken = async (force?: boolean, config?: AxiosRequestConfig, axios?: AxiosInstance) => {
    const userManager = getUserManager();
    let oidcUser = await userManager.getUser();
    let isExpired = !oidcUser || oidcUser.expired;

    if (!isExpired && !force) {
        config.headers.Authorization = `Bearer ${oidcUser!.access_token}`;
        return config;
    }

    if (isRefreshing) {
        console.warn('REQUEST INTERCEPTOR: Token refresh already in progress. Queueing request...');
        return new Promise((resolve, reject) => {
            failedQueue.push({ resolve: (newToken) => {
                config.headers.Authorization = `Bearer ${newToken}`;
                resolve(config);
            }, reject });
        });
    }

    isRefreshing = true;
    try {
        setBackdropLoading(true);

        // 1. Try to refresh via library
        let accessToken: string | null = null;
        try {
            const refreshed = await refreshAccessToken();
            accessToken = refreshed?.access_token ?? null;
        } catch (err) {
            console.warn('Library silent refresh failed', err);
        }

        // 2. If refresh failed, trigger manual login dialog
        if (!accessToken) {
            console.warn('Initiating manual login dialog fallback');
            accessToken = await showLogin();
        }

        if (!accessToken) {
            processQueue(new Error('Login canceled by user.'));
            return Promise.reject(new Error('Token refresh aborted (Login canceled).'));
        }

        processQueue(null, accessToken);
        config.headers.Authorization = `Bearer ${accessToken}`;
        return config;

    } catch (err) {
        processQueue(err);
        return Promise.reject(err);
    } finally {
        setBackdropLoading(false);
        isRefreshing = false;
    }
};



const handle401 = async (error: AxiosError, instance: AxiosInstance, addLog: (message: string, status: 'info' | 'success' | 'error' | 'warning') => void): Promise<any> => {
  const originalRequest = error.config;

  // 1. Check if the error is due to a 401 and hasn't been retried
  if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Queue the request logic (Manual P-Queue Logic)
      return new Promise((resolve, reject) => {
          
          const retryRequest = async () => {
              let newAccessToken: string = '';

              if (!isRefreshing) {
                  isRefreshing = true;
                  addLog('401 hit. Initiating login (Fallback).', 'error');

                  const dialogToken = await showLogin(); 
                  
                  if (!dialogToken) {
                      const cancelError = new Error('Login canceled by user.');
                      processQueue(cancelError);
                      throw cancelError;
                  }

                  newAccessToken = dialogToken;
                  processQueue(null, newAccessToken);
              } else {
                  addLog('401 hit. Request queued (Refresh in progress).', 'warning');
                  // Wait for the ongoing refresh
                  return new Promise<string>((res, rej) => {
                      failedQueue.push({ resolve: res, reject: rej });
                  }).then(token => { newAccessToken = token; });
              }

              // Retry the original request with the new token
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
              addLog(`Retrying ${originalRequest.url} with new token.`, 'info');
              
              // The retry call returns a promise that resolves the result of the second request
              return instance.get(originalRequest.url || '', originalRequest);

          };
          
          retryRequest().then(resolve).catch(err => {
              isRefreshing = false; // Ensure lock is released if we failed the retry
              reject(err);
          });

      });
  }

  // Default error handling (non-401 or final retry failure)
  return Promise.reject(error);
};



const apiClient = axios.create({
    baseURL: window.webConfig.apiUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor (e.g., for auth tokens)
apiClient.interceptors.request.use(
    (config) => {
        if (config.preventAuth) return config;
        return getToken(false, config, axios)
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle common errors like 401 Unauthorized
        if (error.response?.status === 401) {
            console.error('Unauthorized! Redirecting to login...');
        }
        return Promise.reject(error);
    }
);

export default apiClient;
