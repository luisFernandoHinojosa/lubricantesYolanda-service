import { createCategoriaMovimientoSchema, updateCategoriaMovimientoSchema } from './categorias_movimientos.schema.js';
import * as categoriasMovimientosService from './categorias_movimientos.service.js';
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
                errors: error.errors,
            });
        }
        next(error);
    }
};

export const checkCategoriaMovimientoExists = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const categoriaMovimiento = await categoriasMovimientosService.findCategoriaMovimientoById(id);
    if (!categoriaMovimiento) {
        return res.status(404).json({
            status: 'error',
            message: `La categoría de movimiento con ID ${id} no fue encontrada.`,
        });
    }
    req.categoriaMovimiento = categoriaMovimiento;
    next();
});

export const validateCreateCategoriaMovimiento = validateRequest(createCategoriaMovimientoSchema);
export const validateUpdateCategoriaMovimiento = validateRequest(updateCategoriaMovimientoSchema);
