const { ZodError } = require('zod');

/**
 * Generic Validation Middleware
 * 
 * PURPOSE:
 * - Validates incoming requests against Zod schemas
 * - Returns clear error messages on validation failure
 * - Allows requests to proceed if valid
 * 
 * USAGE:
 * router.post('/endpoint', validate(yourSchema), controller);
 */

const validate = (schema) => {
    return async (req, res, next) => {
        try {
            // Validate the request against the schema
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            });

            // If validation passes, continue to next middleware/controller
            next();
        } catch (error) {
            // Handle Zod validation errors
            if (error instanceof ZodError) {
                const errorMessages = error.errors.map((issue) => ({
                    field: issue.path.join('.'),
                    message: issue.message
                }));

                return res.status(400).json({
                    message: 'Validation failed',
                    errors: errorMessages
                });
            }

            // Handle unexpected errors
            return res.status(500).json({
                message: 'Internal server error during validation'
            });
        }
    };
};

module.exports = validate;
