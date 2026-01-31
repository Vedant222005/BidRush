import { useState, useEffect } from 'react';
import StatsCard from '../../components/StatsCard';
import { adminAPI } from '../../services/api';

/**
 * AdminDashboard - Main admin dashboard with stats
 */
const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalAuctions: 0,
        totalBids: 0,
        activeAuctions: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch counts from different endpoints
                const [usersRes, auctionsRes, bidsRes] = await Promise.all([
                    adminAPI.getUsers(),
                    adminAPI.getAuctions(),
                    adminAPI.getBids()
                ]);
                 
                console.log(auctionsRes);
                setStats({
                    totalUsers: usersRes.pagination?.totalItems || 0,
                    totalAuctions: auctionsRes.pagination?.totalItems || 0,
                    totalBids: bidsRes.pagination?.totalItems || 0,
                    activeAuctions: auctionsRes.pagination?.active_count || 0
                });
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatsCard title="Total Users" value={stats.totalUsers} icon="👥" />
                <StatsCard title="Total Auctions" value={stats.totalAuctions} icon="🔨" />
                <StatsCard title="Total Bids" value={stats.totalBids} icon="💰" />
                <StatsCard title="Active Auctions" value={stats.activeAuctions} icon="🟢" />
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a href="/admin/auctions" className="p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                        <p className="font-medium text-orange-600">Manage Auctions</p>
                        <p className="text-sm text-gray-500 mt-1">Activate, cancel, or view all auctions</p>
                    </a>
                    <a href="/admin/users" className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                        <p className="font-medium text-blue-600">View Users</p>
                        <p className="text-sm text-gray-500 mt-1">See all registered users</p>
                    </a>
                    <a href="/admin/bids" className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
                        <p className="font-medium text-green-600">Review Bids</p>
                        <p className="text-sm text-gray-500 mt-1">Cancel fraudulent bids</p>
                    </a>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
