import { useState } from 'react';
import { Navbar, AuctionGrid } from '../components';
import { Link } from 'react-router-dom';

/**
 * AuctionHistory Page
 * 
 * Route: /auctions/history
 * 
 * Components Used:
 * - Navbar - Navigation bar
 * - AuctionGrid - Paginated auction list (filtered for past auctions)
 */
const AuctionHistory = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Auction History</h1>
                        <p className="text-gray-500 mt-2">Browse past auctions and results</p>
                    </div>
                    <Link to="/auctions" className="text-orange-500 font-medium hover:underline">
                        ← Back to Live Auctions
                    </Link>
                </div>

                {/* Search & Filters (Optional, can be added later if needed) */}
                {/* For now, just a clean list */}

                {/* Past Auctions Grid */}
                <div className="mb-12">
                    <AuctionGrid limit={12} filters={{ status: 'sold,ended,cancelled' }} />
                </div>
            </div>
        </div>
    );
};

export default AuctionHistory;
