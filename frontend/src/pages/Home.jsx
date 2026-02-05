import { Navbar, Hero } from '../components';

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
        </div>
    );
};

export default Home;
