import axios from 'axios';

/**
 * API Service with Axios
 * 
 * PURPOSE:
 * - Centralized API configuration
 * - All requests include credentials for cookie auth
 * - Interceptors handle errors globally
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance with defaults
const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,  // Send cookies with every request
    headers: {
        'Content-Type': 'application/json'
    }
});

// Variable to track if we are currently refreshing (to prevent infinite loops)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Response interceptor for error handling & token refresh
api.interceptors.response.use(
    (response) => response.data,
    async (error) => {
        const originalRequest = error.config;
        // If error is 401 and we haven't retried yet
        // This breaks the "Deadlock" loop that causes the infinite loader.
        if (originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh')) {
            const message = error.response?.data?.message || 'Authentication failed';
            return Promise.reject(new Error(message));
        }

        if (error.response?.status === 401 && !originalRequest._retry) {

            if (isRefreshing) {
                // If already refreshing, wait for it to finish
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(() => {
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Call refresh endpoint - it will set new cookie automatically
                await api.post('/auth/refresh');

                processQueue(null, true);
                // Retry original request
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                // If refresh fails, user is truly logged out
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        const message = error.response?.data?.message || 'Something went wrong';
        return Promise.reject(new Error(message));
    }
);

// Auth API
// Backend routes: /login, /register, /logout
// NOTE: /me endpoint doesn't exist in backend yet - needs to be added
export const authAPI = {
    login: (credentials) => api.post('/auth/login', credentials),
    register: (userData) => api.post('/auth/register', userData),
    logout: () => api.post('/auth/refresh/logout'),  //refreshtoken should pass to logout so use refresh
    getMe: () => api.get('/auth/me'),
    refresh: () => api.post('/auth/refresh')
};

// Auction API
// Backend routes: /create, /all, /user/:userId, /update/:id, /delete/:id, /activate/:id
// NOTE: /:id (getById) doesn't exist in backend yet - needs to be added
export const auctionAPI = {
    getAll: (page = 1, limit = 12, filters = {}) => {
        let url = `/auction/all?page=${page}&limit=${limit}`;
        if (filters.status) url += `&status=${filters.status}`;
        return api.get(url);
    },
    getById: (id) => api.get(`/auction/${id}`),
    getUserAuctions: (userId, page = 1) => api.get(`/auction/user/${userId}?page=${page}`),
    create: (auctionData) => api.post('/auction/create', auctionData),
    update: (id, data) => api.patch(`/auction/update/${id}`, data),
    delete: (id) => api.delete(`/auction/delete/${id}`),
    activate: (id) => api.patch(`/auction/activate/${id}`),
    cancel: (id) => api.delete(`/auction/delete/${id}`)
};

// Bid API
// Backend routes: /auction/:auction_id, /winning/:auction_id, /create/:auction_id, /me, /cancel/:bid_id
export const bidAPI = {
    getByAuction: (auctionId, page = 1) => api.get(`/bids/auction/${auctionId}?page=${page}`),
    getWinning: (auctionId) => api.get(`/bids/winning/${auctionId}`),
    getMyBids: (page = 1) => api.get(`/bids/me?page=${page}`),
    placeBid: (auctionId, amount) => api.post(`/bids/create/${auctionId}`, { bid_amount: amount }),
    cancel: (bidId) => api.patch(`/bids/cancel/${bidId}`)
};

// Admin API (requires admin role)
export const adminAPI = {
    // Users
    getUsers: ({ page = 1, limit = 20 } = {}) =>
        api.get(`/auth/admin/users?page=${page}&limit=${limit}`),
    banUser: (userId) =>
        api.patch(`/auth/admin/users/${userId}/ban`),
    unbanUser: (userId) =>
        api.patch(`/auth/admin/users/${userId}/unban`),

    // Auctions
    getAuctions: ({ page = 1, limit = 20 } = {}) =>
        api.get(`/auction/admin/all?page=${page}&limit=${limit}`),
    activateAuction: (id) =>
        api.patch(`/auction/admin/activate/${id}`),
    deleteAuction: (id) =>
        api.delete(`/auction/admin/delete/${id}`),

    // Bids
    getBids: ({ page = 1, limit = 20, auction_id = null } = {}) => {
        let url = `/bids/admin/all?page=${page}&limit=${limit}`;
        if (auction_id) {
            url += `&auction_id=${auction_id}`;
        }
        return api.get(url);
    },
    cancelBid: (bidId) =>
        api.patch(`/bids/cancel/${bidId}`)
};

export default api;

