import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hero Component
 * 
 * HOOKS USED:
 * - useState - Manages search input
 * - useNavigate - Redirects to auctions page with search query
 * 
 * PURPOSE:
 * - Homepage hero section matching BidRush design
 * - Search bar with live auctions badge
 */
const Hero = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const navigate = useNavigate();

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/auctions?search=${encodeURIComponent(searchQuery)}`);
        }
    };

    return (
        <section className="bg-gray-50 py-16 lg:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    {/* Left Content */}
                    <div>
                        {/* Badge */}
                        <span className="inline-block bg-orange-100 text-orange-600 text-sm font-medium px-3 py-1 rounded-full mb-6">
                            LIVE AUCTIONS 24/7
                        </span>

                        {/* Headline */}
                        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                            Your trusted platform for seamless{' '}
                            <span className="text-orange-500">bidding</span>
                        </h1>

                        {/* Description */}
                        <p className="mt-6 text-lg text-gray-600 max-w-lg">
                            Browse exclusive items, place your bids securely, and win with confidence on the world's most reliable marketplace.
                        </p>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="mt-8 flex max-w-md">
                            <div className="relative flex-1">
                                <svg
                                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search for items, categories..."
                                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                />
                            </div>
                            <button type="submit" className="btn-primary rounded-l-none">
                                Search
                            </button>
                        </form>

                        {/* Trust Badges */}
                        <div className="mt-8 flex items-center space-x-6 text-sm text-gray-500">
                            <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                <span>Verified Sellers</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                <span>Secure Payments</span>
                            </div>
                        </div>
                    </div>

                    {/* Right Image */}
                    <div className="hidden lg:block">
                        <div className="rounded-2xl overflow-hidden">
                            <img
                                src="/hero-illustration.png"
                                alt="BidRush Auction Platform"
                                className="w-full h-auto"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
