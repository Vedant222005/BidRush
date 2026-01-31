import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from './Loader';

/**
 * AdminRoute - Protects admin-only routes
 * 
 * - If not logged in → redirect to /login
 * - If logged in but not admin → redirect to /unauthorized
 * - If admin → render child routes
 */
const AdminRoute = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return <Loader />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (user.role !== 'admin') {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
};

export default AdminRoute;
