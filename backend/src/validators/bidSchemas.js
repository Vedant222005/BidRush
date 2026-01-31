const { z } = require('zod');

/**
 * Bid Validation Schemas
 * 
 * PURPOSE:
 * - Validate bid-related requests
 * - Ensure bid amounts and IDs are valid
 */

// Create bid schema
const createBidSchema = z.object({
    params: z.object({
        auction_id: z.string().regex(/^\d+$/, 'Invalid auction ID')
    }),
    body: z.object({
        bid_amount: z.number()
            .positive('Bid amount must be positive')
            .min(1, 'Minimum bid is 1 token')
            .max(1000000000, 'Bid amount is too large')
    })
});

// Cancel bid schema (admin)
const cancelBidSchema = z.object({
    params: z.object({
        bid_id: z.string().regex(/^\d+$/, 'Invalid bid ID')
    })
});

// Get bids by auction schema
const getBidsByAuctionSchema = z.object({
    params: z.object({
        auction_id: z.string().regex(/^\d+$/, 'Invalid auction ID')
    }),
    query: z.object({
        page: z.string().regex(/^\d+$/).optional(),
        limit: z.string().regex(/^\d+$/).optional()
    }).optional()
});

module.exports = {
    createBidSchema,
    cancelBidSchema,
    getBidsByAuctionSchema
};
