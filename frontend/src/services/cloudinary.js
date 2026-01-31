import api from './api';
import axios from 'axios';

/**
 * Upload image to Cloudinary using signed upload
 * 
 * FLOW:
 * 1. Get signature from OUR backend
 * 2. Use signature to upload directly to Cloudinary
 * 3. Return the image URL
 */
export const uploadImage = async (file) => {
  try {
    // Step 1: Get signature from backend
    // Note: api interceptor already extracts response.data, so we get the object directly
    const signatureData = await api.get('/upload/signature');

    // Step 2: Prepare form data for Cloudinary
    const formData = new FormData();
    formData.append('file', file);                          // The actual image
    formData.append('signature', signatureData.signature);  // Proof from backend
    formData.append('timestamp', signatureData.timestamp);  // When signature created
    formData.append('folder', signatureData.folder);        // Where to store
    formData.append('api_key', signatureData.apiKey);       // Your public key

    // Step 3: Upload directly to Cloudinary
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`;

    const { data } = await axios.post(cloudinaryUrl, formData);

    // Step 4: Return useful data
    return {
      url: data.secure_url,      // https://res.cloudinary.com/xxx/image/upload/...
      public_id: data.public_id  // bidrush/auctions/abc123
    };

  } catch (error) {
    console.error('Cloudinary image upload failed:', error);

    // Forward a readable error
    throw new Error(
      error?.response?.data?.error?.message ||
      'Image upload failed'
    );
  }
};

/**
 * Upload multiple images
 */
export const uploadImages = async (files) => {
  try {
    const uploads = Array.from(files).map(file => uploadImage(file));
    return await Promise.all(uploads);
  } catch (error) {
    console.error('Multiple image upload failed:', error);
    throw error;
  }
};
