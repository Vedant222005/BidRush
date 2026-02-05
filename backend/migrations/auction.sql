-- Use an ENUM for status to save space and prevent typos
CREATE TYPE auction_status AS ENUM ('pending', 'active', 'cancelled', 'sold','ended');

CREATE TABLE auctions (
    id SERIAL PRIMARY KEY,
    seller_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Auction details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    version INT DEFAULT 1,  
    
    -- Pricing & Stats
    starting_bid DECIMAL(12,2) NOT NULL,
    current_bid DECIMAL(12,2) DEFAULT 0,
    reserve_price DECIMAL(12,2),
    bid_increment DECIMAL(10,2) DEFAULT 1.00,
    total_bids INT DEFAULT 0, -- Denormalized count for performance
    
    -- Timing
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ NOT NULL,
    last_bid_at TIMESTAMPTZ,
    
    -- Status tracking
    status auction_status DEFAULT 'pending', 
    winner_id INT REFERENCES users(id),
    
    -- Concurrency & Audit
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FULL-TEXT SEARCH (GIN)
-- This allows users to search "Vintage Rolex" and get instant results
CREATE INDEX idx_auctions_search ON auctions USING GIN (
    to_tsvector('english', title || ' ' || COALESCE(description, ''))
);

-- Standard B-Tree indices for filtering and sorting
CREATE INDEX idx_auctions_status_end_time ON auctions(status, end_time) WHERE status = 'active';
CREATE INDEX idx_auctions_seller ON auctions(seller_id);
CREATE INDEX idx_auctions_winner ON auctions(winner_id);