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

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response.data,  // Return data directly
    (error) => {
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
    logout: () => api.post('/auth/logout'),
    getMe: () => api.get('/auth/me')
};

// Auction API
// Backend routes: /create, /all, /user/:userId, /update/:id, /delete/:id, /activate/:id
// NOTE: /:id (getById) doesn't exist in backend yet - needs to be added
export const auctionAPI = {
    getAll: (page = 1, limit = 12) => api.get(`/auction/all?page=${page}&limit=${limit}`),
    // getById: (id) => api.get(`/auction/${id}`),  // TODO: Add this route to backend
    getUserAuctions: (userId, page = 1) => api.get(`/auction/user/${userId}?page=${page}`),
    create: (auctionData) => api.post('/auction/create', auctionData),
    update: (id, data) => api.patch(`/auction/update/${id}`, data),
    delete: (id) => api.delete(`/auction/delete/${id}`),
    activate: (id) => api.patch(`/auction/activate/${id}`)
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

export default api;
