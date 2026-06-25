import { createStockDistribucionSchema, updateStockDistribucionSchema, trasladoStockSchema, ajusteStockSchema } from './stock_distribucion.schema.js';
import * as stockDistribucionService from './stock_distribucion.service.js';
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

export const checkStockDistribucionExists = async (req, res, next) => {
    const { id } = req.params;
    const stockDistribucion = await stockDistribucionService.findStockDistribucionById(id);
    if (!stockDistribucion) {
        return res.status(404).json({
            status: 'error',
            message: `El registro de stock con ID ${id} no fue encontrado.`,
        });
    }
    req.stockDistribucion = stockDistribucion;
    next();
};

export const validateCreateStockDistribucion = validateRequest(createStockDistribucionSchema);
export const validateUpdateStockDistribucion = validateRequest(updateStockDistribucionSchema);
export const validateTrasladoStock = validateRequest(trasladoStockSchema);
export const validateAjusteStock = validateRequest(ajusteStockSchema);
