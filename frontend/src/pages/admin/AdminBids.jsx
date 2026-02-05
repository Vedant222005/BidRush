import { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import { adminAPI } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
/**
 * AdminBids - Bid management page with auction filter
 */
const AdminBids = () => {
    const [bids, setBids] = useState([]);
    const [auctions, setAuctions] = useState([]);
    const [selectedAuction, setSelectedAuction] = useState('all');
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);

    const statusColors = {
        winning: 'bg-green-100 text-green-600',
        outbid: 'bg-gray-100 text-gray-600',
        cancelled: 'bg-red-100 text-red-600'
    };

    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'username', label: 'Bidder' },
        { key: 'auction_title', label: 'Auction' },
        {
            key: 'amount',
            label: 'Amount',
            render: (value) => `₹${parseFloat(value || 0).toFixed(2)}`
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[value] || 'bg-gray-100'}`}>
                    {value}
                </span>
            )
        },
        {
            key: 'placed_at',
            label: 'Placed At',
            render: (value) => new Date(value).toLocaleString()
        }
    ];

    const actions = [
        { label: 'Cancel', action: 'cancel', variant: 'danger' }
    ];

    // Fetch auctions for filter dropdown
    const fetchAuctions = async () => {
        try {
            const response = await adminAPI.getAuctions({ page: 1, limit: 100 });
            setAuctions(response.data || []);
        } catch (err) {
            console.error('Failed to fetch auctions:', err);
        }
    };

    const fetchBids = async (page = 1, auctionId = selectedAuction) => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (auctionId !== 'all') {
                params.auction_id = auctionId;
            }

            const response = await adminAPI.getBids(params);
            setBids(response.data || []);
            setPagination({
                currentPage: response.pagination?.currentPage || 1,
                totalPages: response.pagination?.totalPages || 1
            });
        } catch (err) {
            console.error('Failed to fetch bids:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuctions();
        fetchBids();
    }, []);

    // Refetch when filter changes
    useEffect(() => {
        fetchBids(1, selectedAuction);
    }, [selectedAuction]);

    const handleAction = async (action, bid) => {
        if (action === 'cancel') {
            if (bid.status === 'cancelled') {
                alert('Bid already cancelled');
                return;
            }
            if (!confirm(`Cancel bid of ₹${bid.amount} by ${bid.username}?`)) return;

            try {
                await adminAPI.cancelBid(bid.id);
                fetchBids(pagination.currentPage, selectedAuction);
            } catch (err) {
                alert(err.message || 'Failed to cancel bid');
            }
        }
    };
    
    const socket = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleNewBid = (newBid) => {
            // Only add if we are viewing "All Auctions" OR the specific auction the bid belongs to
            if (selectedAuction === 'all' || selectedAuction == newBid.auction_id) {
                // Prepend new bid to the list
                setBids(prev => [newBid, ...prev]);
            }
        };

        socket.on('new_bid', handleNewBid);

        return () => {
            socket.off('new_bid', handleNewBid);
        };
    }, [socket, selectedAuction]);


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">Bid Management</h1>
            </div>

            {/* Filter Section */}
            <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-gray-700">
                        Filter by Auction:
                    </label>
                    <select
                        value={selectedAuction}
                        onChange={(e) => setSelectedAuction(e.target.value)}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                        <option value="all">All Auctions</option>
                        {auctions.map((auction) => (
                            <option key={auction.id} value={auction.id}>
                                {auction.title} (ID: {auction.id})
                            </option>
                        ))}
                    </select>

                    {selectedAuction !== 'all' && (
                        <button
                            onClick={() => setSelectedAuction('all')}
                            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                        >
                            Clear Filter
                        </button>
                    )}
                </div>
            </div>

            <DataTable
                columns={columns}
                data={bids}
                actions={actions}
                onAction={handleAction}
                pagination={{
                    currentPage: pagination.currentPage,
                    totalPages: pagination.totalPages,
                    onPageChange: (page) => fetchBids(page, selectedAuction)
                }}
                loading={loading}
            />
        </div>
    );
};

export default AdminBids;
