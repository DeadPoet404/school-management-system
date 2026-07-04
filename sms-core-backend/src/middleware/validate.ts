import { Request, Response, NextFunction, RequestHandler } from "express";
import { z } from "zod";

/**
 * Higher-order middleware factory that validates the incoming request body 
 * against a structured Zod schema before hitting the domain controller layers.
 */
export const validate = (schema: z.ZodTypeAny): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // parseAsync strips unmapped parameters safely if .strict() is defined,
      // and natively resolves any custom async validation filters.
      req.body = await schema.parseAsync(req.body);
      
      return next(); // Payload matches schema, hand off to downstream controller
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Formats Zod v4 'issues' into flat dot-notated paths matching your React form layout
        const formattedErrors = error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));

        res.status(400).json({
          success: false,
          message: "Input validation failed.",
          errors: formattedErrors,
        });
        return;
      }

      // Drop general runtime anomalies down into the global interceptor stack
      return next(error);
    }
  };
};