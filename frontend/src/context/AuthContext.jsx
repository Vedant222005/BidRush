import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

/**
 * AuthContext
 * 
 * HOOKS USED:
 * - useState - Manages user state and loading state
 * - useEffect - Checks for existing session on mount
 * - useContext - Provides auth state to child components
 * 
 * PURPOSE:
 * - Global authentication state management
 * - Provides login, logout, register functions
 * - Uses axios-based authAPI
 */

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check for existing session on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const data = await authAPI.getMe();
                setUser(data.user);
            } catch (err) {
                console.log('No active session');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    // Login function
    const login = async (credentials) => {
        const data = await authAPI.login(credentials);
        setUser(data.user);
        return data;
    };

    // Register function
    const register = async (userData) => {
        const data = await authAPI.register(userData);
        return data;
    };

    // Logout function
    const logout = async () => {
        try {
            await authAPI.logout();
        } catch (err) {
            console.error('Logout error:', err);
        }
        setUser(null);
    };

    // Update user balance (after bid, top-up, etc.)
    const updateBalance = (newBalance) => {
        setUser(prev => prev ? { ...prev, balance: newBalance } : null);
    };

    const value = {
        user,
        loading,
        login,
        logout,
        register,
        updateBalance
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
