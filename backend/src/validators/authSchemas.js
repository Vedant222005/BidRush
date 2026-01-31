const { z } = require('zod');

/**
 * Auth Validation Schemas
 * 
 * PURPOSE:
 * - Validate authentication-related requests
 * - Ensure data meets requirements before reaching controller
 */

// Register schema
const registerSchema = z.object({
    body: z.object({
        username: z.string()
            .min(3, 'Username must be at least 3 characters')
            .max(30, 'Username must be less than 30 characters')
            .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),

        email: z.string()
            .email('Invalid email format')
            .toLowerCase(),

        password: z.string()
            .min(6, 'Password must be at least 6 characters')
            .max(100, 'Password is too long'),

        full_name: z.string()
            .min(2, 'Full name must be at least 2 characters')
            .max(100, 'Full name is too long')
    })
});

// Login schema
const loginSchema = z.object({
    body: z.object({
        // Can be either username or email
        username: z.string().optional(),
        email: z.string().optional(),

        password: z.string()
            .min(1, 'Password is required')
    }).refine(
        data => data.username || data.email,
        { message: 'Either username or email is required' }
    )
});

module.exports = {
    registerSchema,
    loginSchema
};
