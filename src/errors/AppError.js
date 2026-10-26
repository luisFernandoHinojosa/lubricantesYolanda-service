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
    constructor(resource = 'Recurso', message = null) {
        super(message || `${resource} no encontrado`, 404, 'NOT_FOUND');
    }
}

export class ValidationError extends AppError {
    constructor(details, message = 'Error de validación') {
        super(message, 422, 'VALIDATION_ERROR', details);
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

export class ForbiddenError extends AppError {
    constructor(message = 'Acceso denegado') {
        super(message, 403, 'FORBIDDEN');
    }
}

// Regla de negocio incumplida (stock insuficiente, pago que no cubre el total, etc.)
export class BusinessRuleError extends AppError {
    constructor(message, code = 'REGLA_NEGOCIO') {
        super(message, 422, code);
    }
}
