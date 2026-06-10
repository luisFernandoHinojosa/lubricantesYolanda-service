export class AppError extends Error {
    constructor(message, statusCode, code, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {
    constructor(resource = 'Recurso') {
        super(`${resource} no encontrado`, 404, 'NOT_FOUND');
    }
}

export class ValidationError extends AppError {
    constructor(details) {
        super('Error de validación', 422, 'VALIDATION_ERROR', details);
    }
}

export class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, 'CONFLICT');
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'No autorizado') {
        super(message, 401, 'UNAUTHORIZED');
    }
}
