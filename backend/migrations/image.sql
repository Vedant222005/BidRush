CREATE TABLE auction_images (
    id SERIAL PRIMARY KEY,
    auction_id INT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    
    -- Storage Info
    image_url VARCHAR(500) NOT NULL,
    storage_key VARCHAR(255),           -- The S3/Cloudinary ID (for deletions)
    
    -- Metadata for UI Performance
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    width INT,                         -- Prevents Layout Shift
    height INT,
    file_size INT,                     -- In bytes
    alt_text VARCHAR(255),
    
    -- Safety & Audit
    status VARCHAR(20) DEFAULT 'active', -- e.g., 'pending_review', 'active'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup when loading an auction page
CREATE INDEX idx_auction_images_lookup ON auction_images(auction_id, display_order);