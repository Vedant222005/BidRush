import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { bidAPI } from '../services/api';

/**
 * BidForm Component
 * 
 * HOOKS USED:
 * - useState - Manages bidAmount input and loading/error states
 * - useEffect - Listens for real-time bid updates via WebSocket
 * - useSocket (custom) - Connects to Socket.io for real-time updates
 * 
 * PROPS:
 * - auctionId: ID of auction to place bid on
 * - currentBid: Current highest bid amount
 * - minIncrement: Minimum bid increment (default 1)
 * - onBidPlaced: Callback after successful bid
 * 
 * PURPOSE:
 * - Form to place new bid on auction
 * - Shows real-time updates when others bid
 */
const BidForm = ({ auctionId, currentBid, minIncrement = 1, onBidPlaced }) => {
    const [bidAmount, setBidAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [latestBid, setLatestBid] = useState(currentBid);

    const socket = useSocket();

    // Calculate minimum required bid
    const minBid = parseFloat(latestBid) + parseFloat(minIncrement);

    // Listen for real-time bid updates
    useEffect(() => {
        if (!socket) return;

        socket.emit('join_auction', auctionId);

        socket.on('new_bid', (data) => {
            setLatestBid(data.amount);
        });

        return () => {
            socket.emit('leave_auction', auctionId);
            socket.off('new_bid');
        };
    }, [socket, auctionId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const amount = parseFloat(bidAmount);

        if (isNaN(amount) || amount < minBid) {
            setError(`Minimum bid is ₹${minBid.toLocaleString('en-IN')}`);
            return;
        }

        setLoading(true);

        try {
            const data = await bidAPI.placeBid(auctionId, amount);
            setBidAmount('');
            if (onBidPlaced) onBidPlaced(data.bid);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl p-6 shadow-md">
            <div className="mb-4">
                <p className="text-sm text-gray-500">Current Bid</p>
                <p className="text-3xl font-bold text-orange-500">
                    ₹{parseFloat(latestBid).toLocaleString('en-IN')}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your Bid (min: ₹{minBid.toLocaleString('en-IN')})
                    </label>
                    <input
                        type="number"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder={`Enter ₹${minBid.toLocaleString('en-IN')} or more`}
                        className="input-field"
                        min={minBid}
                        step="0.01"
                        disabled={loading}
                    />
                </div>

                {error && (
                    <p className="text-red-500 text-sm">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full btn-primary py-3 text-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {loading ? 'Placing Bid...' : 'Place Bid'}
                </button>
            </form>

            <p className="mt-3 text-xs text-gray-500 text-center">
                By placing a bid, you agree to our terms and conditions
            </p>
        </div>
    );
};

export default BidForm;
