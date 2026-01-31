import Pagination from './Pagination';

/**
 * DataTable - Reusable table component for admin panels
 * 
 * @param {Array} columns - [{key, label, render?}]
 * @param {Array} data - Array of objects to display
 * @param {Object} pagination - {currentPage, totalPages, onPageChange}
 * @param {Function} onAction - Callback for action buttons
 * @param {Array} actions - [{label, action, variant}]
 */
const DataTable = ({ columns, data, pagination, onAction, actions, loading }) => {
    if (loading) {
        return (
            <div className="bg-white rounded-xl p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading...</p>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-xl p-8 text-center">
                <p className="text-gray-500">No data found</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key}
                                    className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                                >
                                    {col.label}
                                </th>
                            ))}
                            {actions && actions.length > 0 && (
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Actions
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.map((row, rowIndex) => (
                            <tr key={row.id || rowIndex} className="hover:bg-gray-50 transition-colors">
                                {columns.map((col) => (
                                    <td key={col.key} className="px-6 py-4 text-sm text-gray-700">
                                        {col.render ? col.render(row[col.key], row) : row[col.key]}
                                    </td>
                                ))}
                                {actions && actions.length > 0 && (
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {actions
                                            .filter(action => !action.condition || action.condition(row))
                                            .map((action) => (
                                                <button
                                                    key={action.action}
                                                    onClick={() => onAction(action.action, row)}
                                                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${action.variant === 'danger'
                                                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                                            : action.variant === 'success'
                                                                ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {action.label}
                                                </button>
                                            ))
                                        }
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
                <div className="border-t border-gray-100 p-4">
                    <Pagination
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        onPageChange={pagination.onPageChange}
                    />
                </div>
            )}
        </div>
    );
};

export default DataTable;
