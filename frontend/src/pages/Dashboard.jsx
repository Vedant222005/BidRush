import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Navbar, BalanceCard, AuctionCard, Loader } from '../components';
import { useAuth } from '../context/AuthContext';
import { auctionAPI, bidAPI } from '../services/api';

/**
 * Dashboard Page
 * 
 * Route: /dashboard (Protected)
 * 
 * Components Used:
 * - Navbar, BalanceCard, AuctionCard, Loader
 */
const Dashboard = () => {
    const { user } = useAuth();
    const [myAuctions, setMyAuctions] = useState([]);
    const [myBids, setMyBids] = useState([]);
    const [activeTab, setActiveTab] = useState('auctions');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [auctionsRes, bidsRes] = await Promise.all([
                    auctionAPI.getUserAuctions(user.id),
                    bidAPI.getMyBids()
                ]);
                setMyAuctions(auctionsRes.data || []);
                setMyBids(bidsRes.data || []);
            } catch (err) {
                console.error('Dashboard fetch error:', err);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchData();
    }, [user]);

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Welcome, {user?.full_name || 'User'}!
                        </h1>
                        <p className="text-gray-500 mt-1">Manage your auctions and bids</p>
                    </div>
                    <Link to="/create" className="btn-primary">
                        + Create Auction
                    </Link>
                </div>

                {/* Balance Card */}
                <div className="mb-8 max-w-sm">
                    <BalanceCard />
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('auctions')}
                        className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'auctions'
                                ? 'text-orange-500 border-b-2 border-orange-500'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        My Auctions ({myAuctions.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('bids')}
                        className={`pb-3 px-1 font-medium transition-colors ${activeTab === 'bids'
                                ? 'text-orange-500 border-b-2 border-orange-500'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        My Bids ({myBids.length})
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <Loader text="Loading your data..." />
                ) : activeTab === 'auctions' ? (
                    myAuctions.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl">
                            <p className="text-gray-500">You haven't created any auctions yet.</p>
                            <Link to="/create" className="btn-primary inline-block mt-4">
                                Create Your First Auction
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {myAuctions.map(auction => (
                                <AuctionCard key={auction.id} auction={auction} />
                            ))}
                        </div>
                    )
                ) : (
                    myBids.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-xl">
                            <p className="text-gray-500">You haven't placed any bids yet.</p>
                            <Link to="/auctions" className="btn-primary inline-block mt-4">
                                Browse Auctions
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Auction</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {myBids.map(bid => (
                                        <tr key={bid.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <Link to={`/auction/${bid.auction_id}`} className="text-orange-500 hover:underline">
                                                    {bid.auction_title}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 font-semibold">
                                                ₹{parseFloat(bid.amount).toLocaleString('en-IN')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 text-xs rounded-full ${bid.status === 'winning' ? 'bg-green-100 text-green-700' :
                                                        bid.status === 'outbid' ? 'bg-red-100 text-red-700' :
                                                            'bg-gray-100 text-gray-700'
                                                    }`}>
                                                    {bid.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 text-sm">
                                                {new Date(bid.placed_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>
        </div>
    );
};

export default Dashboard;
