import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BidRushIcon from './BidRushIcon';

/**
 * Navbar Component
 * 
 * HOOKS USED:
 * - useAuth (custom) - Gets user state and logout function from AuthContext
 * 
 * PURPOSE:
 * - Navigation bar with logo, links, and auth buttons
 * - Shows different options for logged-in vs guest users
 */
const Navbar = () => {
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        await logout();
    };

    return (
        <nav className="bg-white shadow-sm sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center space-x-2">
                        <BidRushIcon size={28} color="#f97316" />
                        <span className="text-2xl font-bold text-orange-500">BidRush</span>
                    </Link>

                    {/* Navigation Links */}
                    <div className="hidden md:flex items-center space-x-8">
                        <Link to="/" className="text-gray-600 hover:text-orange-500 transition-colors">
                            Home
                        </Link>
                        <Link to="/auctions" className="text-gray-600 hover:text-orange-500 transition-colors">
                            Auctions
                        </Link>
                        <Link to="/guide" className="text-gray-600 hover:text-orange-500 transition-colors">
                            Guide
                        </Link>
                        <Link to="/support" className="text-gray-600 hover:text-orange-500 transition-colors">
                            Support
                        </Link>
                    </div>

                    {/* Auth Buttons */}
                    <div className="flex items-center space-x-4">
                        {user ? (
                            <>
                                <Link to="/dashboard" className="text-gray-600 hover:text-orange-500">
                                    Dashboard
                                </Link>
                                <Link to="/wallet" className="text-gray-600 hover:text-orange-500">
                                    ₹{parseFloat(user.balance || 0).toFixed(2)}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="btn-secondary text-sm py-1.5 px-4"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="text-gray-600 hover:text-orange-500">
                                    Login
                                </Link>
                                <Link to="/register" className="btn-primary text-sm py-1.5 px-4">
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
