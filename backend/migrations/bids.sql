CREATE TYPE bid_status AS ENUM ('placed', 'winning', 'outbid', 'won', 'expired', 'cancelled', 'refunded', 'rejected');

CREATE TABLE bids (
    id SERIAL PRIMARY KEY,
    auction_id INT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE, 
    amount DECIMAL(12,2) NOT NULL,
    
    -- Status & Metadata
    status bid_status DEFAULT 'placed',
    idempotency_key VARCHAR(255) UNIQUE, -- Prevents duplicate processing
    
    placed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    -- Ensures a user can't place the exact same amount twice on one auction
    CONSTRAINT unique_bid_per_amount UNIQUE (auction_id, bidder_id, amount)
);

-- Optimization: Find the highest bid for an auction instantly
CREATE INDEX idx_bids_winning_finder ON bids(auction_id, amount DESC);
-- Optimization: Find all bids by a specific user (for their "My Bids" page)
CREATE INDEX idx_bids_bidder_lookup ON bids(bidder_id);

