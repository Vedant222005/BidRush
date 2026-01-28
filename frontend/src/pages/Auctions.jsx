import { useState } from 'react';
import { Navbar, AuctionGrid } from '../components';

/**
 * Auctions Page
 * 
 * Route: /auctions
 * 
 * Components Used:
 * - Navbar - Navigation bar
 * - AuctionGrid - Paginated auction list
 */
const Auctions = () => {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">All Auctions</h1>
                    <p className="text-gray-500 mt-2">Browse and bid on amazing items</p>
                </div>

                {/* Search & Filters */}
                <div className="bg-white rounded-xl p-4 shadow-sm mb-8">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative">
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search auctions..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                            <option value="">All Categories</option>
                            <option value="electronics">Electronics</option>
                            <option value="art">Art</option>
                            <option value="collectibles">Collectibles</option>
                            <option value="fashion">Fashion</option>
                        </select>

                        <select className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                            <option value="latest">Latest</option>
                            <option value="ending_soon">Ending Soon</option>
                            <option value="price_low">Price: Low to High</option>
                            <option value="price_high">Price: High to Low</option>
                        </select>
                    </div>
                </div>

                {/* Auction Grid */}
                <AuctionGrid limit={12} />
            </div>
        </div>
    );
};

export default Auctions;
