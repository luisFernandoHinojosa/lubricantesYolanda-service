import { createKardexMovimientoSchema, updateKardexMovimientoSchema } from './kardex_movimientos.schema.js';
import * as kardexService from './kardex_movimientos.service.js';
import { z } from 'zod';

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

export const checkKardexMovimientoExists = async (req, res, next) => {
    const { id } = req.params;
    const movimiento = await kardexService.findKardexMovimientoById(id);
    if (!movimiento) {
        return res.status(404).json({
            status: 'error',
            message: `El movimiento de kardex con ID ${id} no fue encontrado.`,
        });
    }
    req.kardexMovimiento = movimiento;
    next();
};

export const validateCreateKardexMovimiento = validateRequest(createKardexMovimientoSchema);
export const validateUpdateKardexMovimiento = validateRequest(updateKardexMovimientoSchema);
