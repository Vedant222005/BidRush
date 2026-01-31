import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * AdminSidebar - Navigation for admin panel
 */
const AdminSidebar = () => {
    const { user, logout } = useAuth();

    const navItems = [
        { path: '/admin', label: 'Dashboard', icon: '📊' },
        { path: '/admin/users', label: 'Users', icon: '👥' },
        { path: '/admin/auctions', label: 'Auctions', icon: '🔨' },
        { path: '/admin/bids', label: 'Bids', icon: '💰' },
    ];

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
            ? 'bg-orange-500 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`;

    return (
        <aside className="w-64 bg-white border-r border-gray-200 min-h-screen p-4 flex flex-col">
            {/* Logo */}
            <div className="mb-8 px-4">
                <h1 className="text-xl font-bold text-gray-800">🔨 BidRush</h1>
                <p className="text-sm text-gray-500">Admin Panel</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2">
                {navItems.map((item) => (
                    <NavLink key={item.path} to={item.path} end={item.path === '/admin'} className={linkClass}>
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User Info & Logout */}
            <div className="border-t border-gray-200 pt-4 mt-4">
                <div className="px-4 mb-3">
                    <p className="font-medium text-gray-800">{user?.username}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                </div>
                <NavLink to="/" className="flex items-center gap-3 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <span>🏠</span>
                    <span>Back to Site</span>
                </NavLink>
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg mt-1"
                >
                    <span>🚪</span>
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
