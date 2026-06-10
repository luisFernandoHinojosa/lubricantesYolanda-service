import asyncHandler from '../../utils/asyncHandler.js';
import * as movimientosService from './movimientos.service.js';

export const findAll = asyncHandler(async (req, res, next) => {
    const result = await movimientosService.findAllMovimientos(req.query);
    res.status(200).json({ status: 'success', data: result });
});

export const findOne = asyncHandler(async (req, res, next) => {
    const { movimiento } = req;
    res.status(200).json({ status: 'success', data: movimiento });
});

export const create = asyncHandler(async (req, res, next) => {
    const { id_sucursal, Empleado } = req.user;

    const data = {
        ...req.body,
        sucursalId: id_sucursal,
        empleadoId: Empleado?.id || null,
    };

    const newMovimiento = await movimientosService.createMovimiento(data);
    res.status(201).json({ status: 'success', data: newMovimiento });
});

export const update = asyncHandler(async (req, res, next) => {
    const updatedMovimiento = await movimientosService.updateMovimiento(req.movimiento, req.body);
    res.status(200).json({ status: 'success', data: updatedMovimiento });
});

export const remove = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    await movimientosService.deleteMovimiento(id);
    res.status(204).send();
});

export const findByDateRange = asyncHandler(async (req, res, next) => {
    const result = await movimientosService.findMovimientosByDateRange(req.validatedQuery);
    res.status(200).json({ status: 'success', data: result });
});
