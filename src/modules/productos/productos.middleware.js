import { createProductoSchema, updateProductoSchema } from './productos.schema.js';
import { productosService } from './productos.service.js';
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

export const checkProductoExists = async (req, res, next) => {
    try {
        const { id } = req.params;
        const producto = await productosService.getById(id);
        console.log("mi producto 1", producto);
        req.producto = producto;
        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Validación para crear un producto (solo datos maestros del catálogo).
 * No incluye validaciones de lote, stock, ubicación ni precios de compra.
 */
export const validateCreateProducto = (req, res, next) => {
    const d = req.body;
    const errores = [];

    // Normalizar booleanos que pueden llegar como strings (FormData)
    if (typeof d.maneja_vencimiento === 'string') {
        d.maneja_vencimiento = d.maneja_vencimiento === 'true';
    }

    // Parsear presentaciones si llegan como JSON string (FormData)
    if (typeof d.presentaciones === 'string') {
        try {
            d.presentaciones = JSON.parse(d.presentaciones);
        } catch {
            errores.push('presentaciones no es un JSON válido.');
        }
    }

    // Validaciones de datos maestros del producto
    if (!d.nombre_comercial?.trim()) errores.push('nombre_comercial es requerido.');
    if (!d.id_categoria) errores.push('id_categoria es requerido.');
    if (!d.id_marca) errores.push('id_marca es requerido.');
    if (!d.id_unidad_medida) errores.push('id_unidad_medida es requerido.');
    if (d.stock_minimo !== undefined && (isNaN(d.stock_minimo) || d.stock_minimo < 0)) {
        errores.push('stock_minimo debe ser un número >= 0.');
    }

    // Validaciones de presentaciones (si vienen)
    if (d.presentaciones !== undefined) {
        if (!Array.isArray(d.presentaciones)) {
            errores.push('presentaciones debe ser un array.');
        } else {
            d.presentaciones.forEach((p, i) => {
                const base = `presentaciones[${i}]`;

                if (!p.nombre?.trim())
                    errores.push(`${base}.nombre es requerido.`);

                if (p.factor_conversion === undefined || p.factor_conversion === null)
                    errores.push(`${base}.factor_conversion es requerido.`);
                else if (parseFloat(p.factor_conversion) <= 1)
                    errores.push(`${base}.factor_conversion debe ser > 1 (es una agrupación de unidades).`);

                if (p.precio_especial === undefined || p.precio_especial === null || p.precio_especial === '') {
                    p.precio_especial = 0;
                } else if (parseFloat(p.precio_especial) < 0) {
                    errores.push(`${base}.precio_especial debe ser >= 0.`);
                }
            });
            const barcodes = d.presentaciones.map((p) => p.codigo_barras).filter(Boolean);
            if (new Set(barcodes).size !== barcodes.length) {
                errores.push('Hay codigo_barras duplicados en las presentaciones.');
            }

            const skus = d.presentaciones.map((p) => p.sku).filter(Boolean);
            if (new Set(skus).size !== skus.length) {
                errores.push('Hay sku duplicados en las presentaciones.');
            }
        }
    }
    if (errores.length > 0) {
        return res.status(400).json({
            status: 'error',
            message: errores,
            errores,
        });
    }
    next();
};

export const validateUpdateProducto = validateRequest(updateProductoSchema);
