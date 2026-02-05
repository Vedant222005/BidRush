import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute Component
 * 
 * HOOKS USED:
 * - useAuth (custom) - Gets user and loading state from AuthContext
 * 
 * PROPS:
 * - children: Components to render if authenticated
 * 
 * PURPOSE:
 * - Wraps protected routes
 * - Redirects to /unauthorized if not logged in
 * - Shows loading state while checking auth
 */
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();

    // Show loading spinner while checking authentication
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    // Redirect to unauthorized page if not logged in
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Render protected content
    return children;
};

export default ProtectedRoute;
