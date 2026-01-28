import { useState, useEffect } from 'react';
import AuctionCard from './AuctionCard';
import Pagination from './Pagination';
import { auctionAPI } from '../services/api';

/**
 * AuctionGrid Component
 * 
 * HOOKS USED:
 * - useState - Manages auctions array, loading state, and pagination
 * - useEffect - Fetches auctions when page/filters change
 * 
 * PROPS:
 * - userId: Optional - if provided, fetches user's auctions
 * - limit: Items per page (default: 12)
 * 
 * PURPOSE:
 * - Displays grid of auction cards
 * - Handles pagination
 */
const AuctionGrid = ({ userId = null, limit = 12 }) => {
    const [auctions, setAuctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0
    });

    useEffect(() => {
        const fetchAuctions = async () => {
            setLoading(true);
            try {
                const data = userId
                    ? await auctionAPI.getUserAuctions(userId, pagination.currentPage)
                    : await auctionAPI.getAll(pagination.currentPage, limit);

                setAuctions(data.data);
                setPagination(prev => ({
                    ...prev,
                    totalPages: data.pagination.totalPages,
                    totalItems: data.pagination.totalItems
                }));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAuctions();
    }, [userId, pagination.currentPage, limit]);

    const handlePageChange = (newPage) => {
        setPagination(prev => ({ ...prev, currentPage: newPage }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="card animate-pulse">
                        <div className="h-48 bg-gray-200"></div>
                        <div className="p-4 space-y-3">
                            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500">{error}</p>
                <button
                    onClick={() => setPagination(prev => ({ ...prev, currentPage: 1 }))}
                    className="mt-4 btn-secondary"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (auctions.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">No auctions found</p>
            </div>
        );
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {auctions.map((auction) => (
                    <AuctionCard key={auction.id} auction={auction} />
                ))}
            </div>

            {pagination.totalPages > 1 && (
                <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                />
            )}
        </div>
    );
};

export default AuctionGrid;
