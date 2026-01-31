/**
 * User Repository
 * 
 * PURPOSE:
 * - All database queries related to users
 * - Separates data access from business logic
 * - Reusable across multiple controllers
 */

/**
 * Lock user row and get their data (for transactions)
 */
const lockAndGetUser = async (client, userId) => {
    const result = await client.query(
        `SELECT id, balance, version FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
    );
    return result.rows[0];
};

/**
 * Get user by ID (no lock)
 */
const getUserById = async (con, userId) => {
    const result = await con.query(
        `SELECT id, username, email, balance, full_name, role, version FROM users WHERE id = $1`,
        [userId]
    );
    return result.rows[0];
};

/**
 * Get user by username or email
 */
const getUserByUsernameOrEmail = async (con, identifier) => {
    const result = await con.query(
        `SELECT id, username, email, password_hash, balance, full_name, role, status, version 
     FROM users WHERE username = $1 OR email = $1`,
        [identifier]
    );
    return result.rows[0];
};

/**
 * Create new user
 */
const createUser = async (client, userData) => {
    const { email, username, password_hash, full_name } = userData;

    const result = await client.query(
        `INSERT INTO users (email, username, password_hash, full_name) 
     VALUES ($1, $2, $3, $4) 
     RETURNING id, username, email, balance, full_name, role`,
        [email, username, password_hash, full_name]
    );

    return result.rows[0];
};

/**
 * Update user balance (with optimistic locking)
 */
const updateBalance = async (client, userId, amount, version) => {
    const result = await client.query(
        `UPDATE users 
     SET balance = balance + $1, version = version + 1 
     WHERE id = $2 AND version = $3
     RETURNING balance, version`,
        [amount, userId, version]
    );
    return result.rows[0];
};

/**
 * Get all users with pagination (admin)
 */
const getAllUsers = async (con, limit, offset) => {
    const result = await con.query(
        `SELECT id, username, email, full_name, balance, role, status, created_at 
     FROM users 
     ORDER BY created_at DESC 
     LIMIT $1 OFFSET $2`,
        [limit, offset]
    );
    return result.rows;
};

/**
 * Get total user count
 */
const getUserCount = async (con) => {
    const result = await con.query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count);
};

/**
 * Check if email exists
 */
const emailExists = async (con, email) => {
    const result = await con.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
    );
    return result.rows.length > 0;
};

/**
 * Check if username exists
 */
const usernameExists = async (con, username) => {
    const result = await con.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
    );
    return result.rows.length > 0;
};

/**
 * Update user status (ban/unban)
 */
const updateUserStatus = async (con, userId, status) => {
    const result = await con.query(
        `UPDATE users SET status = $1 WHERE id = $2 RETURNING id, username, status`,
        [status, userId]
    );
    return result.rows[0];
};

module.exports = {
    lockAndGetUser,
    getUserById,
    getUserByUsernameOrEmail,
    createUser,
    updateBalance,
    getAllUsers,
    getUserCount,
    emailExists,
    usernameExists,
    updateUserStatus
};

