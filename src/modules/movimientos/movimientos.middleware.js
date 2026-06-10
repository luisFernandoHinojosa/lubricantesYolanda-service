import { createMovimientoSchema, updateMovimientoSchema, getMovimientosByRangeSchema } from './movimientos.schema.js';
import * as movimientosService from './movimientos.service.js';
import { z } from 'zod';
import asyncHandler from '../../utils/asyncHandler.js';

export const validateRequest = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Error de validación',
                errors: (error.issues || error.errors || []).map(e => e.message),
            });
        }
        next(error);
    }
};

export const validateQuery = (schema) => (req, res, next) => {
    try {
        req.validatedQuery = schema.parse(req.query);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                status: 'error',
                message: 'Error de validación en los parámetros de búsqueda',
                errors: (error.issues || error.errors || []).map(e => e.message),
            });
        }
        next(error);
    }
};

export const checkMovimientoExists = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const movimiento = await movimientosService.findMovimientoById(id);
    if (!movimiento) {
        return res.status(404).json({
            status: 'error',
            message: `El movimiento con ID ${id} no fue encontrado.`,
        });
    }
    req.movimiento = movimiento;
    next();
});

export const validateCreateMovimiento = validateRequest(createMovimientoSchema);
export const validateUpdateMovimiento = validateRequest(updateMovimientoSchema);
export const validateGetMovimientosByRange = validateQuery(getMovimientosByRangeSchema);
