import { ErrorPage } from '../components';

/**
 * Not Found Page (404)
 * 
 * Route: * (catch-all)
 */
const NotFound = () => {
    return <ErrorPage type="404" />;
};

export default NotFound;
