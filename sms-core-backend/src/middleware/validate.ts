import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Middleware factory that validates req.body against a Zod schema.
 * If validation fails, it immediately returns a 400 error with clean messages.
 * (Updated for Zod v4)
 */
export const validate = (schema: z.ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next(); // Valid payload, proceed to controller
    } catch (error) {
      // Use z.ZodError for v4 compatibility
      if (error instanceof z.ZodError) {
        // In Zod v4, the array is called 'issues', not 'errors'
        const errors = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Input validation failed.",
          errors,
        });
      }
      
      // If it's not a Zod error, pass it to the global error handler
      next(error);
    }
  };
};