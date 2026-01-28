import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Navbar, Timer, BidForm, BidHistory, Loader } from '../components';
import { auctionAPI } from '../services/api';

/**
 * Auction Detail Page
 * 
 * Route: /auction/:id
 * 
 * Components Used:
 * - Navbar, Timer, BidForm, BidHistory, Loader
 */
const AuctionDetail = () => {
    const { id } = useParams();
    const [auction, setAuction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchAuction = async () => {
            try {
                // TODO: Add getById to backend
                const data = await auctionAPI.getAll(1, 100);
                const found = data.data.find(a => a.id === parseInt(id));
                if (found) {
                    setAuction(found);
                } else {
                    setError('Auction not found');
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchAuction();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 py-16">
                    <Loader size="lg" text="Loading auction..." />
                </div>
            </div>
        );
    }

    if (error || !auction) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 py-16 text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Auction Not Found</h2>
                    <p className="text-gray-500 mt-2">{error || 'This auction does not exist'}</p>
                    <a href="/auctions" className="btn-primary inline-block mt-4">
                        Browse Auctions
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Left: Image */}
                    <div>
                        <div className="bg-white rounded-xl overflow-hidden shadow-md">
                            <img
                                src={auction.primary_image || '/placeholder.jpg'}
                                alt={auction.title}
                                className="w-full h-96 object-cover"
                            />
                        </div>

                        {/* Description */}
                        <div className="bg-white rounded-xl p-6 shadow-md mt-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Description</h3>
                            <p className="text-gray-600">
                                {auction.description || 'No description available.'}
                            </p>
                        </div>
                    </div>

                    {/* Right: Details + Bid */}
                    <div className="space-y-6">
                        {/* Title & Status */}
                        <div className="bg-white rounded-xl p-6 shadow-md">
                            <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full mb-3
                ${auction.status === 'active' ? 'bg-green-100 text-green-700' :
                                    auction.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-gray-100 text-gray-700'}`}>
                                {auction.status}
                            </span>
                            <h1 className="text-2xl font-bold text-gray-900">{auction.title}</h1>
                            <p className="text-gray-500 mt-1">Category: {auction.category || 'General'}</p>

                            {/* Timer */}
                            {auction.status === 'active' && (
                                <div className="mt-4">
                                    <p className="text-sm text-gray-500 mb-2">Time Remaining</p>
                                    <Timer endTime={auction.end_time} />
                                </div>
                            )}
                        </div>

                        {/* Bid Form */}
                        {auction.status === 'active' && (
                            <BidForm
                                auctionId={auction.id}
                                currentBid={auction.current_bid}
                                minIncrement={auction.bid_increment || 1}
                            />
                        )}

                        {/* Bid History */}
                        <BidHistory auctionId={auction.id} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuctionDetail;
