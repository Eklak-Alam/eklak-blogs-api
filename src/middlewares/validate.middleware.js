import { ZodError } from 'zod';

/**
 * Enterprise-grade Zod Validation Middleware for Express v5.
 * Safely handles read-only getters and formats errors perfectly for React Hook Form.
 */
export const validate = (schema) => async (req, res, next) => {
  try {
    // Enterprise Optimization: parseAsync supports async refinements (e.g., DB checks)
    const parsed = await schema.parseAsync({
      body: req.body ?? {},
      query: req.query,
      params: req.params,
    });
    
    // 1. Assign validated body (req.body is usually safe to reassign if using express.json)
    if (parsed.body) {
      req.body = parsed.body;
    }
    
    // 2. EXPRESS v5 SAFE ASSIGNMENT for Query
    // We cannot reassign req.query. We must mutate it safely.
    if (parsed.query) {
      // Security: Clear out unvalidated garbage keys, then inject the Zod-sanitized ones
      Object.keys(req.query).forEach((key) => delete req.query[key]);
      Object.assign(req.query, parsed.query);
    }
    
    // 3. EXPRESS v5 SAFE ASSIGNMENT for Params
    if (parsed.params) {
      Object.keys(req.params).forEach((key) => delete req.params[key]);
      Object.assign(req.params, parsed.params);
    }
    
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      // Format errors specifically for your frontend React Hook Form
      const errorMessages = error.issues.map((issue) => {
        // Drops 'body' or 'query' prefix so the field matches the exact frontend input name
        const fieldPath = issue.path.length > 1 ? issue.path.slice(1).join('.') : issue.path.join('.');
        
        return {
          field: fieldPath,
          message: issue.message,
        };
      });

      return res.status(400).json({
        success: false,
        status: 'error', // Kept as 'error' so your frontend handleApiError catches it smoothly
        message: 'Validation failed. Please check your inputs.',
        errors: errorMessages, 
      });
    }
    
    // Pass non-Zod errors (like DB crashes) to your global error middleware
    return next(error);
  }
};