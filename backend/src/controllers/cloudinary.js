const cloudinary = require('../config/cloudinary');

/**
 * Generate signed upload parameters
 * 
 * WHY SIGNED?
 * - Frontend can't have API_SECRET (anyone could see it)
 * - Backend creates a "signature" = proof that this upload is allowed
 * - Signature is valid only for short time (timestamp)
 */
const getSignature = async (req, res) => {
  try {
    // Current time in seconds (Unix timestamp)
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Folder where images will be stored in Cloudinary
    const folder = 'bidrush/auctions';
    
    // Generate the signature using API_SECRET
    // This proves the upload request came from our backend
    const signature = cloudinary.utils.api_sign_request(
      { 
        timestamp: timestamp,
        folder: folder 
      },
      process.env.CLOUDINARY_API_SECRET  // Secret key signs the request
    );
    
    // Send back everything frontend needs to upload
    res.json({
      signature: signature,           // The proof
      timestamp: timestamp,           // When it was created
      folder: folder,                 // Where to store
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY  // Public key (safe to share)
    });
    
  } catch (error) {
    console.error('Signature generation error:', error);
    res.status(500).json({ message: 'Failed to generate upload signature' });
  }
};

module.exports = { getSignature };