const { z } = require('zod');

/**
 * Auction Validation Schemas
 * 
 * PURPOSE:
 * - Validate auction-related requests
 * - Ensure data integrity before database operations
 */

// Create auction schema
const createAuctionSchema = z.object({
    body: z.object({
        title: z.string()
            .min(5, 'Title must be at least 5 characters')
            .max(200, 'Title is too long'),

        description: z.string()
            .min(10, 'Description must be at least 10 characters')
            .max(2000, 'Description is too long')
            .optional(),

        category: z.enum([
            'Electronics',
            'Art',
            'Collectibles',
            'Fashion',
            'Vehicles',
            'Other'
        ], { errorMap: () => ({ message: 'Invalid category' }) })
            .optional(),

        starting_bid: z.number()
            .positive('Starting bid must be positive')
            .min(1, 'Minimum starting bid is 1 token'),

        end_time: z.string()
            .datetime({ message: 'Invalid datetime format' })
            .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Invalid datetime format')),

        images: z.array(
            z.object({
                url: z.string().url('Invalid image URL'),
                public_id: z.string().min(1, 'Image public_id is required')
            })
        ).min(1, 'At least one image is required')
            .max(5, 'Maximum 5 images allowed')
    })
});

// Update auction schema
const updateAuctionSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, 'Invalid auction ID')
    }),
    body: z.object({
        title: z.string()
            .min(5, 'Title must be at least 5 characters')
            .max(200, 'Title is too long')
            .optional(),

        description: z.string()
            .min(10, 'Description must be at least 10 characters')
            .max(2000, 'Description is too long')
            .optional(),

        category: z.enum([
            'electronics',
            'art',
            'collectibles',
            'fashion',
            'vehicles',
            'other'
        ]).optional(),

        reserve_price: z.number()
            .positive('Reserve price must be positive')
            .optional(),

        end_time: z.string()
            .datetime({ message: 'Invalid datetime format' })
            .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Invalid datetime format'))
            .optional(),

        version: z.number()
            .int('Version must be an integer')
            .nonnegative('Version must be non-negative')
    })
});

// Activate auction schema (admin)
const activateAuctionSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, 'Invalid auction ID')
    })
});

// Delete auction schema
const deleteAuctionSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/, 'Invalid auction ID')
    })
});

module.exports = {
    createAuctionSchema,
    updateAuctionSchema,
    activateAuctionSchema,
    deleteAuctionSchema
};
