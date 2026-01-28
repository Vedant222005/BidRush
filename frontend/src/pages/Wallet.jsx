import { Navbar, BalanceCard, TopUpForm } from '../components';

/**
 * Wallet Page
 * 
 * Route: /wallet (Protected)
 * 
 * Components Used:
 * - Navbar, BalanceCard, TopUpForm
 */
const Wallet = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-2xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Wallet</h1>
                <p className="text-gray-500 mb-8">Manage your funds</p>

                <div className="space-y-6">
                    {/* Balance Card */}
                    <BalanceCard />

                    {/* Top Up Form */}
                    <TopUpForm />

                    {/* Transaction History Placeholder */}
                    <div className="bg-white rounded-xl p-6 shadow-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
                        <div className="text-center py-8 text-gray-500">
                            <p>No transactions yet</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Wallet;
