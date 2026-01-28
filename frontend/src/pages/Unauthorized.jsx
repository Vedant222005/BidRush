import { ErrorPage } from '../components';

/**
 * Unauthorized Page
 * 
 * Route: /unauthorized
 */
const Unauthorized = () => {
    return <ErrorPage type="unauthorized" />;
};

export default Unauthorized;
