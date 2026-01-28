import { useState } from 'react';

/**
 * TopUpForm Component
 * 
 * HOOKS USED:
 * - useState - Manages amount input and loading state
 * 
 * PROPS:
 * - onSuccess: Callback after successful top-up
 * 
 * PURPOSE:
 * - Form to add funds to wallet
 * - Preset amount buttons for quick selection
 */
const TopUpForm = ({ onSuccess }) => {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const presetAmounts = [500, 1000, 2000, 5000];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const value = parseFloat(amount);
        if (isNaN(value) || value < 100) {
            setError('Minimum top-up amount is ₹100');
            return;
        }

        setLoading(true);

        try {
            // TODO: Integrate with payment gateway
            const response = await fetch('/api/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amount: value })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.message);

            setAmount('');
            if (onSuccess) onSuccess(data.newBalance);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl p-6 shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Funds</h3>

            {/* Preset Amounts */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                {presetAmounts.map((preset) => (
                    <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(preset.toString())}
                        className={`py-2 rounded-lg font-medium transition-colors ${amount === preset.toString()
                                ? 'bg-orange-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        ₹{preset}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Amount
                    </label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount (min ₹100)"
                        className="input-field"
                        min="100"
                    />
                </div>

                {error && (
                    <p className="text-red-500 text-sm">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading || !amount}
                    className={`w-full btn-primary py-3 ${loading || !amount ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {loading ? 'Processing...' : `Add ₹${amount || '0'}`}
                </button>
            </form>

            <p className="mt-3 text-xs text-gray-500 text-center">
                Secure payment powered by Razorpay
            </p>
        </div>
    );
};

export default TopUpForm;
