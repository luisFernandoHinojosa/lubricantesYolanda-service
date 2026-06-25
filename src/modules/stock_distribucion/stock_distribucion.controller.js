import asyncHandler from '../../utils/asyncHandler.js';
import * as stockDistribucionService from './stock_distribucion.service.js';

export const findAll = asyncHandler(async (req, res, next) => {
    const result = await stockDistribucionService.findAllStockDistribucion(req.query);
    res.status(200).json({ status: 'success', data: result });
});

export const findOne = asyncHandler(async (req, res, next) => {
    const { stockDistribucion } = req;
    res.status(200).json({ status: 'success', data: stockDistribucion });
});

export const create = asyncHandler(async (req, res, next) => {
    const newStock = await stockDistribucionService.createStockDistribucion(req.body);
    res.status(201).json({ status: 'success', data: newStock });
});

export const update = asyncHandler(async (req, res, next) => {
    const updatedStock = await stockDistribucionService.updateStockDistribucion(req.stockDistribucion, req.body);
    res.status(200).json({ status: 'success', data: updatedStock });
});

export const remove = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    await stockDistribucionService.deleteStockDistribucion(id);
    res.status(204).send();
});

export const getTotalStock = asyncHandler(async (req, res, next) => {
    const { id_producto } = req.params;
    const total = await stockDistribucionService.getTotalStockForProduct(id_producto);
    res.status(200).json({ status: 'success', data: { total } });
});

export const traslado = asyncHandler(async (req, res, next) => {
    // Si no tienes el middleware de autenticación activado aquí y no hay req.user, 
    // se requeriría inyectarlo. Por seguridad pondremos null si no existe.
    const id_usuario = req.user ? req.user.id : null;

    await stockDistribucionService.transferirStock(req.body, id_usuario);

    res.status(200).json({
        status: 'success',
        message: 'El traslado de stock se ejecutó de forma correcta.'
    });
});

export const getStockPorUbicacion = asyncHandler(async (req, res) => {
    const { id_producto } = req.params;
    const data = await stockDistribucionService.getStockPorUbicacionForProduct(id_producto);
    res.status(200).json({ status: 'success', data });
});

export const ajustarStock = asyncHandler(async (req, res, next) => {
    const id_usuario = req.user ? req.user.id : null;
    await stockDistribucionService.ajustarStock(req.stockDistribucion, req.body, id_usuario);
    
    res.status(200).json({
        status: 'success',
        message: 'El ajuste de stock se ejecutó de forma correcta.'
    });
});
