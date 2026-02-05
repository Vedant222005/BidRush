import { useState, useEffect } from 'react';
import DataTable from '../../components/DataTable';
import { adminAPI } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
/**
 * AdminUsers - User management page with ban/unban functionality
 */
const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);

    const columns = [
        { key: 'id', label: 'ID' },
        { key: 'username', label: 'Username' },
        { key: 'email', label: 'Email' },
        { key: 'full_name', label: 'Name' },
        {
            key: 'balance',
            label: 'Balance',
            render: (value) => `₹${parseFloat(value || 0).toFixed(2)}`
        },
        {
            key: 'role',
            label: 'Role',
            render: (value) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {value || 'user'}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (value) => (
                <span className={`px-2 py-1 rounded text-xs font-medium ${value === 'banned' ? 'bg-red-100 text-red-600' :
                    value === 'suspended' ? 'bg-yellow-100 text-yellow-600' :
                        'bg-green-100 text-green-600'
                    }`}>
                    {value || 'active'}
                </span>
            )
        },
        {
            key: 'created_at',
            label: 'Joined',
            render: (value) => new Date(value).toLocaleDateString()
        }
    ];

    const actions = [
        {
            label: 'Ban',
            action: 'ban',
            variant: 'danger',
            condition: (user) => user.status !== 'banned' && user.role !== 'admin'
        },
        {
            label: 'Unban',
            action: 'unban',
            variant: 'success',
            condition: (user) => user.status === 'banned'
        }
    ];

    const fetchUsers = async (page = 1) => {
        setLoading(true);
        try {
            const response = await adminAPI.getUsers({ page, limit: 20 });
            setUsers(response.data || []);
            setPagination({
                currentPage: response.pagination?.currentPage || 1,
                totalPages: response.pagination?.totalPages || 1
            });
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAction = async (action, user) => {
        if (action === 'ban') {
            if (!confirm(`Ban user ${user.username}? They won't be able to login or bid.`)) return;

            try {
                await adminAPI.banUser(user.id);
                fetchUsers(pagination.currentPage);
            } catch (err) {
                alert(err.message || 'Failed to ban user');
            }
        } else if (action === 'unban') {
            if (!confirm(`Unban user ${user.username}?`)) return;

            try {
                await adminAPI.unbanUser(user.id);
                fetchUsers(pagination.currentPage);
            } catch (err) {
                alert(err.message || 'Failed to unban user');
            }
        }
    };

    const handlePageChange = (page) => {
        fetchUsers(page);
    };

    const socket = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleNewUser = (newUser) => {
            // Add new user to top of list
            setUsers(prev => [newUser, ...prev]);
        };

        const handleBalanceUpdate = (data) => {
            setUsers(prev => prev.map(user =>
                user.id === data.userId ? { ...user, balance: data.balance } : user
            ));
        };

        socket.emit('join_admin_room');
        socket.on('new_user', handleNewUser);
        socket.on('admin_balance_update', handleBalanceUpdate);

        return () => {
            socket.emit('leave_admin_room');
            socket.off('new_user', handleNewUser);
            socket.off('admin_balance_update', handleBalanceUpdate);
        };
    }, [socket]);


    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Users</h1>
                <p className="text-gray-500">
                    Total: {pagination.totalPages * 20} users
                </p>
            </div>

            <DataTable
                columns={columns}
                data={users}
                loading={loading}
                actions={actions}
                onAction={handleAction}
                pagination={{
                    currentPage: pagination.currentPage,
                    totalPages: pagination.totalPages,
                    onPageChange: handlePageChange
                }}
            />
        </div>
    );
};

export default AdminUsers;
