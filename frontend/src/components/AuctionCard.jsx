import { Link } from 'react-router-dom';
import Timer from './Timer';

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
    const { id, title, current_bid, primary_image, end_time, status } = auction;

    return (
        <Link to={`/auction/${id}`} className="card overflow-hidden group">
            {/* Image Container */}
            <div className="relative h-48 overflow-hidden bg-gray-100">
                <img
                    src={primary_image || '/placeholder.jpg'}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Status Badge */}
                <span className={`absolute top-3 right-3 px-2 py-1 text-xs font-medium rounded-full
          ${status === 'active' ? 'bg-green-100 text-green-700' :
                        status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'}`}>
                    {status}
                </span>
            </div>

            {/* Content */}
            <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate group-hover:text-orange-500 transition-colors">
                    {title}
                </h3>

                <div className="mt-3 flex justify-between items-center">
                    <div>
                        <p className="text-xs text-gray-500">Current Bid</p>
                        <p className="text-lg font-bold text-orange-500">
                            ₹{parseFloat(current_bid).toLocaleString('en-IN')}
                        </p>
                    </div>

                    {status === 'active' && (
                        <Timer endTime={end_time} />
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
