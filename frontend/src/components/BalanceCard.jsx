import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * BalanceCard Component
 * 
 * HOOKS USED:
 * - useAuth (custom) - Gets user balance from AuthContext
 * 
 * PURPOSE:
 * - Displays user's wallet balance
 * - Quick link to top-up page
 */
const BalanceCard = () => {
    const { user } = useAuth();
    const balance = user?.balance || 0;

    return (
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-orange-100 text-sm">Available Balance</p>
                    <p className="text-3xl font-bold mt-1">
                        ₹{parseFloat(balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                </div>
                <div className="bg-white/20 rounded-full p-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                </div>
            </div>

            <div className="mt-6 flex space-x-3">
                <Link
                    to="/wallet"
                    className="flex-1 bg-white text-orange-500 py-2 rounded-lg font-medium text-center hover:bg-orange-50 transition-colors"
                >
                    Add Funds
                </Link>
                <button className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default BalanceCard;
