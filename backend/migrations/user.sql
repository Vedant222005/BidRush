-- Creating an ENUM for status to handle users more professionally
CREATE TYPE user_status AS ENUM ('active', 'banned');
CREATE TYPE user_role as ENUM ('user','admin');

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    
    -- Financials
    balance DECIMAL(12,2) DEFAULT 0,
    -- Money locked in active bids that cannot be spent elsewhere
    reserved_balance DECIMAL(12,2) DEFAULT 0, 
    version INT DEFAULT 1,  
    role user_role DEFAULT 'user',
    -- Status & Security
    status user_status DEFAULT 'active',
    is_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to update the updated_at column automatically on every change
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to call the function before any update
CREATE TRIGGER update_user_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();