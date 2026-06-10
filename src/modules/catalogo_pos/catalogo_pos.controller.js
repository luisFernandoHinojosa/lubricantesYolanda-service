import * as catalogoService from './catalogo_pos.service.js';

export const buscarProductos = async (req, res, next) => {
    try {
        const { id_sucursal } = req.user;
        const { q = '', solo_con_stock = 'true', limit = 20 } = req.query;

        if (q.trim().length < 1) {
            return res.status(400).json({
                status: 400,
                mensaje: 'El parámetro "q" debe tener al menos 1 carácter.',
            });
        }

        const data = await catalogoService.buscarProductos({
            query: q.trim(),
            id_sucursal,
            solo_con_stock: solo_con_stock !== 'false',
            limit: Math.min(parseInt(limit) || 20, 50),
        });

        return res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        next(err);
    }
};

export const buscarPorBarcode = async (req, res, next) => {
    try {
        const { id_sucursal } = req.user;
        const { codigo } = req.params;

        const data = await catalogoService.buscarPorBarcode({
            barcode: codigo.trim(),
            id_sucursal,
        });

        return res.status(200).json({
            status: "success",
            data
        });
    } catch (err) {
        next(err);
    }
};

export const getProducto = async (req, res, next) => {
    try {
        const { id_sucursal } = req.user;

        const data = await catalogoService.getProductoParaPOS({
            id_producto: req.params.id,
            id_sucursal,
        });

        return res.status(200).json({ status: "success", data });
    } catch (err) {
        next(err);
    }
};

export const validarCantidad = async (req, res, next) => {
    try {
        const { id_sucursal } = req.user;
        const { id } = req.params;
        const { cantidad = 1, id_presentacion } = req.query;

        if (parseFloat(cantidad) <= 0) {
            return res.status(400).json({
                status: 400,
                mensaje: 'La cantidad debe ser mayor a 0.',
            });
        }

        const data = await catalogoService.validarCantidad({
            id_producto: id,
            id_presentacion: id_presentacion || null,
            cantidad: parseFloat(cantidad),
            id_sucursal,
        });

        return res.status(200).json({ status: "success", data });
    } catch (err) {
        next(err);
    }
};