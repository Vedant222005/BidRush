import { useState, useEffect } from 'react';
import { bidAPI } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { Modal } from './index';

/**
 * BidHistory Component
 * 
 * HOOKS USED:
 * - useState - Manages bids array, loading, and pagination
 * - useEffect - Fetches bid history when auctionId changes
 * - useSocket - Real-time WebSocket updates
 * 
 * PROPS:
 * - auctionId: ID of auction to fetch bids for
 * 
 * PURPOSE:
 * - Displays list of all bids for an auction
 * - Highlights winning bid
 * - Supports pagination
 * - Real-time updates via WebSocket
 */
const BidHistory = ({ auctionId, totalBids }) => {
    const [bids, setBids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [isModalOpen, setIsModalOpen] = useState(false);

    const socket = useSocket();

    // Fetch bids function
    const fetchBids = async (page = 1) => {
        console.log('Fetching bids for auction ID:', auctionId); // Debug log for auctionId
        if (page === 1) setLoading(true);
        try {
            const data = await bidAPI.getByAuction(auctionId, page);

            // If page 1, replace. If > 1, append.
            setBids(prev => page === 1 ? data.data : [...prev, ...data.data]);

            setPagination({
                currentPage: data.pagination.currentPage,
                totalPages: data.pagination.totalPages
            });
        } catch (err) {
            console.error('Failed to fetch bids:', err);
        } finally {
            if (page === 1) setLoading(false);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchBids(pagination.currentPage);
    }, [auctionId, pagination.currentPage]);

    // Real-time WebSocket updates
    useEffect(() => {
        if (!socket) return;

        socket.on('new_bid', (newBid) => {
            // Only update if this bid is for our auction
            if (newBid.auction_id != auctionId) return;

            // Update bids: add new bid and mark old winning as outbid
            setBids(prev => {
                const updated = prev.map(b =>
                    b.status === 'winning' ? { ...b, status: 'outbid' } : b
                );
                // Add new bid at top, avoid duplicates
                return [newBid, ...updated.filter(b => b.id !== newBid.id)];
            });
        });

        return () => {
            socket.off('new_bid');
        };
    }, [socket, auctionId]);

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    if (loading && pagination.currentPage === 1) {
        return (
            <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex justify-between p-3 bg-gray-100 rounded-lg">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                ))}
            </div>
        );
    }

    // Hide history if no bids OR (reset auction AND not admin)
    if (bids.length === 0 || (!isAdmin && totalBids === 0)) {
        return (
            <div className="text-center py-8 text-gray-500">
                No bids yet. Be the first to bid!
            </div>
        );
    }

    // Preview shows top 5
    const previewBids = bids.slice(0, 5);

    const BidList = ({ items }) => (
        <div className="space-y-3">
            {items.map((bid) => (
                <div
                    key={bid.id}
                    className={`flex justify-between items-center p-3 rounded-lg ${bid.status === 'winning'
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50'
                        }`}
                >
                    <div className="flex items-center space-x-3">
                        {bid.status === 'winning' && (
                            <span className="text-green-500 text-lg">👑</span>
                        )}
                        <div>
                            <p className="font-semibold text-gray-900">
                                {bid.username || 'User'}
                            </p>
                            <p className="text-xs text-gray-500">{formatTime(bid.placed_at)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-gray-900">₹{parseFloat(bid.amount).toLocaleString('en-IN')}</p>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${bid.status === 'winning' ? 'bg-green-100 text-green-700' :
                            bid.status === 'outbid' ? 'bg-gray-100 text-gray-600' :
                                'bg-gray-100 text-gray-600'
                            }`}>
                            {bid.status}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="bg-white rounded-xl p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Bid History</h3>

            <BidList items={previewBids} />

            {(bids.length > 5 || pagination.totalPages > 1) && (
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full mt-4 py-2 bg-gray-50 text-blue-600 font-medium hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                    View All Bids
                </button>
            )}

            {/* Full History Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`Bid History (${totalBids})`}
                size="lg"
            >
                <div className="space-y-4">
                    <BidList items={bids} />

                    {/* Load More Button (Only in Modal) */}
                    {pagination.currentPage < pagination.totalPages && (
                        <button
                            onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                            className="w-full py-3 text-orange-500 font-medium hover:bg-orange-50 rounded-lg transition-colors"
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Load More Bids'}
                        </button>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default BidHistory;
