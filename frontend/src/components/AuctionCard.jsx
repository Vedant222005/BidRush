import { useState, useEffect } from 'react'; // Add hooks
import { Link } from 'react-router-dom';
import Timer from './Timer';
import { useSocket } from '../hooks/useSocket'; // Import socket hook
/**
 * AuctionCard Component
 * 
 * HOOKS USED:
 * - None (stateless component)
 * 
 * PROPS:
 * - auction: Object containing {id, title, current_bid, primary_image, end_time, status}
 * 
 * PURPOSE:
 * - Display auction preview in grid
 * - Shows image, title, current bid, and countdown
 */
const AuctionCard = ({ auction }) => {

    const [auctionData, setAuctionData] = useState(auction);

    const socket = useSocket();

    useEffect(() => {
        if (!socket) return;

        // Listen for bid updates
        const handleNewBid = (newBid) => {
            if (newBid.auction_id === auction.id) {
                setAuctionData(prev => ({
                    ...prev,
                    current_bid: newBid.amount
                }));
            }
        };

        // Listen for general auction updates (status, title, end_time)
        const handleAuctionUpdate = (updatedData) => {
            if (updatedData.id === auction.id) {
                setAuctionData(prev => ({
                    ...prev,
                    ...updatedData
                }));
            }
        };
        const handleAuctionReset = (data) => {
            if (data.id === auction.id) {
                setAuctionData(prev => ({
                    ...prev,
                    ...data
                }));
            }
        }
        socket.on('auction_reset', handleAuctionReset);
        socket.on('new_bid', handleNewBid);
        socket.on('auction_update', handleAuctionUpdate);

        // Cleanup
        return () => {
            socket.off('new_bid', handleNewBid);
            socket.off('auction_update', handleAuctionUpdate);
            socket.off('auction_reset', handleAuctionReset);
        };
    }, [socket, auction.id]);


    return (
        <Link to={`/auction/${auction.id}`} className="card overflow-hidden group">
            {/* Image Container */}
            <div className="relative h-48 overflow-hidden bg-gray-100">
                <img
                    src={auctionData.primary_image || '/placeholder.jpg'}
                    alt={auctionData.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Status Badge */}
                <span className={`absolute top-3 right-3 px-2 py-1 text-xs font-medium rounded-full
          ${auctionData.status === 'active' ? 'bg-green-100 text-green-700' :
                        auctionData.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'}`}>
                    {auctionData.status}
                </span>
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate group-hover:text-orange-500 transition-colors">
                    {auctionData.title}
                </h3>

                <div className="mt-3 flex justify-between items-center">
                    <div>
                        <p className="text-xs text-gray-500">
                            {auctionData.status === 'pending' ? 'Starting Bid' : 'Current Bid'}
                        </p>
                        <p className="text-lg font-bold text-orange-500">
                            ₹{parseFloat(auctionData.current_bid).toLocaleString('en-IN')}
                        </p>
                    </div>

                    {auctionData.status === 'active' && (
                        <div className="text-right">
                            <p className="text-xs text-gray-500 mb-1">Ends in</p>
                            <Timer endTime={auctionData.end_time} />
                        </div>
                    )}

                    {auctionData.status === 'pending' && (
                        <div className="text-right">
                            <p className="text-xs text-gray-500 mb-1">Starts in</p>
                            <Timer endTime={auctionData.start_time} />
                        </div>
                    )}
                </div>

                <button className="w-full mt-4 btn-primary text-sm">
                    Bid Now
                </button>
            </div>
        </Link>
    );
};

export default AuctionCard;
