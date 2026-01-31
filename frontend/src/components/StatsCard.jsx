/**
 * StatsCard - Display a single statistic with icon
 */
const StatsCard = ({ title, value, icon, trend, trendUp }) => {
    return (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-gray-500 text-sm font-medium">{title}</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
                    {trend && (
                        <p className={`text-sm mt-2 ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                            {trendUp ? '↑' : '↓'} {trend}
                        </p>
                    )}
                </div>
                <div className="text-4xl">{icon}</div>
            </div>
        </div>
    );
};

export default StatsCard;
