import asyncHandler from '../../utils/asyncHandler.js';
import * as kardexService from './kardex_movimientos.service.js';

export const findAll = asyncHandler(async (req, res, next) => {
    const result = await kardexService.findAllKardexMovimientos(req.query);
    res.status(200).json({ status: 'success', data: result });
});

export const findOne = asyncHandler(async (req, res, next) => {
    const { kardexMovimiento } = req;
    res.status(200).json({ status: 'success', data: kardexMovimiento });
});

export const create = asyncHandler(async (req, res, next) => {
    const newMovimiento = await kardexService.createKardexMovimiento({
        ...req.body,
        id_usuario: req.user ? req.user.id : req.body.id_usuario // Ensure user ID is tracked if available in req.user
    });
    res.status(201).json({ status: 'success', data: newMovimiento });
});

export const update = asyncHandler(async (req, res, next) => {
    const updatedMovimiento = await kardexService.updateKardexMovimiento(req.kardexMovimiento, req.body);
    res.status(200).json({ status: 'success', data: updatedMovimiento });
});

export const remove = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    await kardexService.deleteKardexMovimiento(id);
    res.status(204).send();
});
