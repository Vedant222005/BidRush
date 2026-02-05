import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navbar, Loader } from '../components';
import { auctionAPI } from '../services/api';

/**
 * Edit Auction Page
 * 
 * Route: /auction/edit/:id (Protected)
 */
const EditAuction = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [version, setVersion] = useState(0); // For headers/optimistic locking

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        end_time: ''
    });

    // Fetch existing data
    useEffect(() => {
        const fetchAuction = async () => {
            try {
                const response = await auctionAPI.getById(id);
                const data = response.data;

                // Pre-fill form
                setFormData({
                    title: data.title,
                    description: data.description,
                    category: data.category,
                    // Format date for datetime-local input (YYYY-MM-DDThh:mm)
                    end_time: new Date(data.end_time).toISOString().slice(0, 16)
                });
                setVersion(data.version);

                // Quick validation: prevent editing if bids exist
                if (data.total_bids > 0) {
                    alert('Cannot edit auction with active bids');
                    navigate(`/auction/${id}`);
                }
            } catch (err) {
                setError(err.message || 'Failed to load auction');
            } finally {
                setLoading(false);
            }
        };

        fetchAuction();
    }, [id, navigate]);

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            await auctionAPI.update(id, {
                ...formData,
                version: version // Required for backend check
            });
            alert('Auction updated successfully!');
            navigate(`/auction/${id}`);
        } catch (err) {
            setError(err.message || 'Failed to update auction');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 py-16">
                    <Loader size="lg" text="Loading auction details..." />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-2xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Auction</h1>
                <p className="text-gray-500 mb-8">Update your listing details</p>

                <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-md space-y-6">

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className="input-field"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            className="input-field"
                        />
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleChange}
                            className="input-field"
                        >
                            <option value="">Select Category</option>
                            <option value="electronics">Electronics</option>
                            <option value="art">Art</option>
                            <option value="collectibles">Collectibles</option>
                            <option value="fashion">Fashion</option>
                            <option value="vehicles">Vehicles</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    {/* End Time */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                        <input
                            type="datetime-local"
                            name="end_time"
                            value={formData.end_time}
                            onChange={handleChange}
                            className="input-field"
                            required
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => navigate(`/auction/${id}`)}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className={`flex-1 py-3 text-white font-bold rounded-xl transition-all ${submitting
                                    ? 'bg-orange-300 cursor-not-allowed'
                                    : 'bg-orange-500 hover:bg-orange-600 shadow-lg'
                                }`}
                        >
                            {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditAuction;
