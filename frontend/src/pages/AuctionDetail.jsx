import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar, Timer, BidForm, BidHistory, Loader } from '../components';
import { auctionAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
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
    const navigate = useNavigate();
    const { user } = useAuth();
    const [auction, setAuction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        const fetchAuction = async () => {
            try {
                const response = await auctionAPI.getById(id);
                const data = response.data;
                setAuction(data);
                // Set the default big image to the first one in the ordered array
                if (data.images && data.images.length > 0) {
                    setSelectedImage(data.images[0]);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchAuction();
    }, [id]);

    const socket = useSocket();
    useEffect(() => {
        if (!socket) return;

        // Listen for bid updates
        const handleNewBid = (newBid) => {
            if (newBid.auction_id == id) {
                setAuction(prev => ({
                    ...prev,
                    current_bid: newBid.amount
                }));
            }
        };
        // Listen for general auction updates (status, title, end_time)
        const handleAuctionUpdate = (updatedData) => {
            if (updatedData.id == id) {
                setAuction(prev => ({
                    ...prev,
                    ...updatedData
                }));
            }
        };

        // Listen for reset (when bid cancelled)
        const handleAuctionReset = (resetData) => {
            if (resetData.id == id) {
                setAuction(prev => ({
                    ...prev,
                    ...resetData
                }));
            }
        };

        socket.on('new_bid', handleNewBid);
        socket.on('auction_update', handleAuctionUpdate);
        socket.on('auction_reset', handleAuctionReset);

        // Cleanup
        return () => {
            socket.off('new_bid', handleNewBid);
            socket.off('auction_update', handleAuctionUpdate);
            socket.off('auction_reset', handleAuctionReset);
        };
    }, [socket, id]);
    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel this auction? This action cannot be undone.')) {
            return;
        }

        try {
            await auctionAPI.cancel(id);
            alert('Auction cancelled successfully');
            navigate('/dashboard');
        } catch (err) {
            alert(err.message || 'Failed to cancel auction');
        }
    };

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

    const isOwner = user && auction.seller_id === user.id;
    const canCancel = isOwner && (auction.status === 'active' || auction.status === 'pending') && auction.total_bids === 0;

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Left: Image & Gallery */}
                    <div>
                        <div className="bg-white rounded-xl overflow-hidden shadow-md">
                            {/* Main Featured Image - Now dynamic based on state */}
                            <img
                                src={selectedImage || '/placeholder.jpg'}
                                alt={auction.title}
                                className="w-full h-96 object-cover transition-all duration-300"
                            />
                        </div>

                        {/* Thumbnail Gallery */}
                        {auction.images && auction.images.length > 1 && (
                            <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                                {auction.images.map((imgUrl, index) => (
                                    <div key={index} className="flex-shrink-0">
                                        <img
                                            src={imgUrl}
                                            alt={`View ${index + 1}`}
                                            // Add a blue border if this thumbnail is the one selected
                                            className={`w-20 h-20 object-cover rounded-lg border-2 transition-all cursor-pointer ${selectedImage === imgUrl ? 'border-blue-500 scale-105' : 'border-transparent'
                                                }`}
                                            // THE FIX: Clicking this updates the state, which re-renders the big image
                                            onClick={() => setSelectedImage(imgUrl)}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ... Description ... */}

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
                            <div className="flex justify-between items-start mb-3">
                                <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full
                    ${auction.status === 'active' ? 'bg-green-100 text-green-700' :
                                        auction.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'}`}>
                                    {auction.status}
                                </span>
                                {canCancel && (
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => navigate(`/auction/edit/${id}`)}
                                            className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={handleCancel}
                                            className="text-red-500 hover:text-red-700 font-medium text-sm transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
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

                        {/* Bid Form or Status Message */}
                        {auction.status === 'active' && !isOwner ? (
                            <BidForm
                                auctionId={auction.id}
                                currentBid={auction.current_bid}
                                minIncrement={auction.bid_increment || 1}
                            />
                        ) : (
                            <div className="bg-white rounded-xl p-6 shadow-md text-center">
                                {auction.status === 'ended' || auction.status === 'sold' ? (
                                    <div className="text-gray-500">
                                        <h3 className="text-xl font-bold mb-2">Auction Ended</h3>
                                        <p>This auction has ended. No further bids are accepted.</p>
                                    </div>
                                ) : auction.status === 'cancelled' ? (
                                    <div className="text-red-500">
                                        <h3 className="text-xl font-bold mb-2">Auction Cancelled</h3>
                                        <p>This auction was cancelled by the seller or admin.</p>
                                    </div>
                                ) : auction.status === 'pending' ? (
                                    <div className="text-yellow-600">
                                        <h3 className="text-xl font-bold mb-2">Starting Soon</h3>
                                        <p>Bidding for this item has not started yet.</p>
                                    </div>
                                ) : isOwner ? (
                                    <div className="text-blue-600">
                                        <h3 className="text-lg font-bold mb-2">Your Auction</h3>
                                        <p>You cannot place bids on your own auction.</p>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {/* Bid History */}
                        <BidHistory auctionId={auction.id} totalBids={auction.total_bids} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuctionDetail;