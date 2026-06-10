import * as comprasService from './compras.service.js';

export const createCompra = async (req, res, next) => {
    try {
        const id_usuario = req.user.id;
        const nuevaCompra = await comprasService.createCompra(req.body, id_usuario);
        res.status(201).json({
            status: 'success',
            message: 'Compra registrada, lotes e inventario actualizados exitosamente.',
            data: nuevaCompra,
        });
    } catch (error) {
        next(error);
    }
};

export const getCompraById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const compra = await comprasService.getCompraById(id);
        res.status(200).json({
            status: 'success',
            data: compra,
        });
    } catch (error) {
        next(error);
    }
};

export const getAllCompras = async (req, res, next) => {
    try {
        const result = await comprasService.getAllCompras(req.query);
        res.status(200).json({
            status: 'success',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const compra = await comprasService.updateCompra(id, req.body);
        res.json({ status: 'success', data: compra });
    } catch (err) {
        next(err);
    }
};

export const remove = async (req, res, next) => {
    try {
        const { id } = req.params;
        await comprasService.deleteCompra(id);
        res.json({ status: 'success', data: { message: 'Compra eliminada correctamente.' } });
    } catch (err) {
        next(err);
    }
};