import { ValidationError } from '../errors/AppError.js';

export const validate = (schema) => (req, _res, next) => {
    const result = schema.safeParse({
        body: req.body,
        params: req.params,
        query: req.query,
    });

    if (!result.success) {
        const details = result.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
        }));
        return next(new ValidationError(details));
    }

    req.validated = result.data;

    next();
};