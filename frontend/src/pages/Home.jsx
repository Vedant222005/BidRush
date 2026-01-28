import { Navbar, Hero, AuctionGrid } from '../components';

/**
 * Home Page
 * 
 * Route: /
 * 
 * Components Used:
 * - Navbar - Navigation bar
 * - Hero - Hero section with search
 * - AuctionGrid - Featured auctions
 */
const Home = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <Hero />

            {/* Featured Auctions Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Featured Auctions</h2>
                        <p className="text-gray-500 mt-1">Discover amazing items up for bid</p>
                    </div>
                    <a href="/auctions" className="text-orange-500 font-medium hover:underline">
                        View All →
                    </a>
                </div>

                <AuctionGrid limit={8} />
            </section>
        </div>
    );
};

export default Home;
