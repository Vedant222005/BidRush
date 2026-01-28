import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components';
import { auctionAPI } from '../services/api';
import { uploadImages } from '../services/cloudinary'; // Import your new service

/**
 * Create Auction Page with Secure Cloudinary Uploads
 */
const CreateAuction = () => {
    const navigate = useNavigate();
    
    // UI States
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    
    // Form States
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        category: '',
        starting_bid: '',
        end_time: ''
    });

    const handleChange = (e) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        
        // Basic Validation
        if (files.length > 5) {
            setError('Maximum 5 images allowed');
            return;
        }
        
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const invalidFile = files.find(f => !validTypes.includes(f.type));
        if (invalidFile) {
            setError('Only JPEG, PNG, and WEBP images are allowed');
            return;
        }
        
        setError(''); // Clear errors if valid
        setSelectedFiles(files);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // 1. Validation
        if (!formData.title || !formData.starting_bid || !formData.end_time) {
            setError('Please fill in all required fields');
            return;
        }

        if (selectedFiles.length === 0) {
            setError('Please select at least one image');
            return;
        }

        setLoading(true);

        try {
            // 2. Upload images to Cloudinary via Signed Upload
            setUploading(true);
            const uploadedImagesData = await uploadImages(selectedFiles);
            setUploading(false);

            // 3. Create Auction in Backend with Cloudinary URLs
            const response = await auctionAPI.create({
                ...formData,
                starting_bid: parseFloat(formData.starting_bid),
                images: uploadedImagesData // Array of { url, public_id }
            });

            // 4. Success - Redirect to the new auction page
            navigate(`/auction/${response.auction_id}`);
        } catch (err) {
            setError(err.message || 'Failed to create auction. Please try again.');
            setUploading(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="max-w-2xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Auction</h1>
                <p className="text-gray-500 mb-8">List your item for bidding using tokens</p>

                <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-md space-y-6">
                    
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="e.g., Vintage Rolex Watch"
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
                            placeholder="Describe your item details..."
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

                    {/* Pricing and Timing Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Starting Bid (Tokens) *</label>
                            <input
                                type="number"
                                name="starting_bid"
                                value={formData.starting_bid}
                                onChange={handleChange}
                                placeholder="100"
                                min="1"
                                className="input-field"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time *</label>
                            <input
                                type="datetime-local"
                                name="end_time"
                                value={formData.end_time}
                                onChange={handleChange}
                                className="input-field"
                                required
                            />
                        </div>
                    </div>

                    {/* File Upload Section */}
                    <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Images * (max 5)
                        </label>
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            onChange={handleFileSelect}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                        />
                        {selectedFiles.length > 0 && (
                            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                                {selectedFiles.map((file, idx) => (
                                    <div key={idx} className="text-xs bg-white border rounded px-2 py-1 whitespace-nowrap">
                                        {file.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status and Errors */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                            loading 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-orange-500 hover:bg-orange-600 shadow-lg active:transform active:scale-95'
                        }`}
                    >
                        {uploading ? 'Uploading Images...' : loading ? 'Finalizing Auction...' : 'Launch Auction'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateAuction;