/**
 * Loader Component
 * 
 * HOOKS USED:
 * - None (stateless component)
 * 
 * PROPS:
 * - size: 'sm' | 'md' | 'lg' - Size of loader
 * - text: Optional loading text
 * 
 * PURPOSE:
 * - Reusable loading spinner
 */
const Loader = ({ size = 'md', text = 'Loading...' }) => {
    const sizeClasses = {
        sm: 'w-6 h-6 border-2',
        md: 'w-10 h-10 border-3',
        lg: 'w-16 h-16 border-4'
    };

    return (
        <div className="flex flex-col items-center justify-center py-8">
            <div
                className={`${sizeClasses[size]} border-orange-500 border-t-transparent rounded-full animate-spin`}
            ></div>
            {text && (
                <p className="mt-4 text-gray-500 text-sm">{text}</p>
            )}
        </div>
    );
};

export default Loader;
