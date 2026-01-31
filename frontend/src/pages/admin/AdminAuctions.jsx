import { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import { adminAPI } from '../../services/api';

/**
 * AdminAuctions - Auction management page
 */
const AdminAuctions = () => {
    const [auctions, setAuctions] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);

    const statusColors = {
        pending: 'bg-yellow-100 text-yellow-600',
        active: 'bg-green-100 text-green-600',
        ended: 'bg-gray-100 text-gray-600',
        sold: 'bg-blue-100 text-blue-600',
        cancelled: 'bg-red-100 text-red-600'
    };

    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'title', label: 'Title' },
        { key: 'seller_name', label: 'Seller' },
        {
            key: 'current_bid',
            label: 'Current Bid',
            render: (value) => `₹${parseFloat(value || 0).toFixed(2)}`
        },
        { key: 'total_bids', label: 'Bids' },
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
            key: 'end_time',
            label: 'Ends',
            render: (value) => new Date(value).toLocaleString()
        }
    ];

    const actions = [
        { label: 'Activate', action: 'activate', variant: 'success' },
        { label: 'Cancel', action: 'cancel', variant: 'danger' }
    ];

    const fetchAuctions = async (page = 1) => {
        setLoading(true);
        try {
            const response = await adminAPI.getAuctions({ page, limit: 20 });
            setAuctions(response.data || []);
            setPagination({
                currentPage: response.pagination?.currentPage || 1,
                totalPages: response.pagination?.totalPages || 1
            });
        } catch (err) {
            console.error('Failed to fetch auctions:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuctions();
    }, []);

    const handleAction = async (action, auction) => {
        if (action === 'activate') {
            if (auction.status !== 'pending') {
                alert('Only pending auctions can be activated');
                return;
            }
            if (!confirm(`Activate auction "${auction.title}"?`)) return;

            try {
                await adminAPI.activateAuction(auction.id);
                fetchAuctions(pagination.currentPage);
            } catch (err) {
                alert(err.message || 'Failed to activate');
            }
        }

        if (action === 'cancel') {
            if (auction.status === 'cancelled' || auction.status === 'ended') {
                alert('Auction already closed');
                return;
            }
            if (!confirm(`Cancel auction "${auction.title}"?`)) return;

            try {
                await adminAPI.deleteAuction(auction.id);
                fetchAuctions(pagination.currentPage);
            } catch (err) {
                alert(err.message || 'Failed to cancel');
            }
        }
    };

    const handlePageChange = (page) => {
        fetchAuctions(page);
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Auctions</h1>
                <button
                    onClick={() => fetchAuctions(pagination.currentPage)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                >
                    Refresh
                </button>
            </div>

            <DataTable
                columns={columns}
                data={auctions}
                loading={loading}
                actions={actions}
                onAction={handleAction}
                pagination={{
                    currentPage: pagination.currentPage,
                    totalPages: pagination.totalPages,
                    onPageChange: handlePageChange
                }}
            />
        </div>
    );
};

export default AdminAuctions;
