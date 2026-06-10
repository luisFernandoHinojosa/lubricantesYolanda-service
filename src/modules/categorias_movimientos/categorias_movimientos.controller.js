import asyncHandler from '../../utils/asyncHandler.js';
import * as categoriasMovimientosService from './categorias_movimientos.service.js';

export const findAll = asyncHandler(async (req, res, next) => {
    const result = await categoriasMovimientosService.findAllCategoriasMovimientos(req.query);
    res.status(200).json({ status: 'success', data: result });
});

export const findOne = asyncHandler(async (req, res, next) => {
    const { categoriaMovimiento } = req;
    res.status(200).json({ status: 'success', data: categoriaMovimiento });
});

export const create = asyncHandler(async (req, res, next) => {
    const newCategoriaMovimiento = await categoriasMovimientosService.createCategoriaMovimiento(req.body);
    res.status(201).json({ status: 'success', data: newCategoriaMovimiento });
});

export const update = asyncHandler(async (req, res, next) => {
    const updatedCategoriaMovimiento = await categoriasMovimientosService.updateCategoriaMovimiento(req.categoriaMovimiento, req.body);
    res.status(200).json({ status: 'success', data: updatedCategoriaMovimiento });
});

export const remove = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    await categoriasMovimientosService.deleteCategoriaMovimiento(id);
    res.status(204).send();
});
