import axios, { type AxiosRequestConfig } from 'axios';
import { setBackdropLoading } from '../components/BackdropLoader';



import { getUserManager, refreshAccessToken } from '@adolf94/ar-auth-client';

let isRedirecting = false;

// Navigate the browser to the identity server instead of opening a login popup.
// The page unloads during the redirect, so callers should not expect a token back.
export const redirectToLogin = () => {
    if (isRedirecting) return;
    isRedirecting = true;
    getUserManager().signinRedirect()
        .catch((err) => console.error('Login redirect failed:', err))
        .finally(() => { isRedirecting = false; });
};

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

        // 2. If refresh failed, redirect the browser to the identity server
        if (!accessToken) {
            console.warn('Silent refresh failed. Redirecting to login.');
            redirectToLogin();
            processQueue(new Error('Redirecting to login.'));
            return Promise.reject(new Error('Redirecting to login.'));
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
