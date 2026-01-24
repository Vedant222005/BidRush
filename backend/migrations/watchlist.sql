CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auction_id INT NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    
    -- Scalability Additions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Helps track if the user was alerted when the auction was "Ending Soon"
    last_notified_at TIMESTAMPTZ, 
    
    -- Prevents a user from watching the same item twice
    CONSTRAINT unique_watchlist UNIQUE (user_id, auction_id)
);

-- Index for the "My Watchlist" page (High performance for the user)
CREATE INDEX idx_watchlist_user ON watchlist(user_id);

-- Index for the "Watch Count" on the auction page
-- Used for: "15 people are watching this item!"
CREATE INDEX idx_watchlist_auction_count ON watchlist(auction_id);