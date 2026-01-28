import { Link } from 'react-router-dom';

/**
 * ErrorPage Component
 * 
 * HOOKS USED:
 * - None (stateless component)
 * 
 * PROPS:
 * - type: '404' | 'unauthorized' - Determines which error to show
 * 
 * PURPOSE:
 * - Reusable error page for 404 and unauthorized states
 * - Shows appropriate message and action button
 */
const ErrorPage = ({ type = '404' }) => {
    const content = {
        '404': {
            code: '404',
            title: 'Page Not Found',
            message: "Oops! The page you're looking for doesn't exist or has been moved.",
            buttonText: 'Go Home',
            buttonLink: '/'
        },
        'unauthorized': {
            code: '401',
            title: 'Access Denied',
            message: "You need to be logged in to access this page. Please sign in to continue.",
            buttonText: 'Sign In',
            buttonLink: '/login'
        }
    };

    const { code, title, message, buttonText, buttonLink } = content[type] || content['404'];

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="text-center">
                {/* Error Code */}
                <h1 className="text-8xl font-bold text-orange-500 mb-4">{code}</h1>

                {/* Title */}
                <h2 className="text-3xl font-semibold text-gray-900 mb-4">{title}</h2>

                {/* Message */}
                <p className="text-gray-500 max-w-md mx-auto mb-8">{message}</p>

                {/* Actions */}
                <div className="flex justify-center space-x-4">
                    <Link to={buttonLink} className="btn-primary">
                        {buttonText}
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="btn-secondary"
                    >
                        Go Back
                    </button>
                </div>

                {/* Decorative Element */}
                <div className="mt-12">
                    <Link to="/" className="text-xl font-bold text-gray-300 hover:text-orange-500 transition-colors">
                        BidRush
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ErrorPage;
