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
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params
            });

            next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Take FIRST real error
                const firstIssue = error.issues[0];

                return res.status(400).json({
                    message: firstIssue.message
                });
            }

            return res.status(500).json({
                message: 'Internal server error during validation'
            });
        }
    };
};

module.exports = validate;
