import db from '../../database/index.js';

export const validateProforma = (req, res, next) => {
    const {
        id_cliente, items,
        tipo_descuento_global, valor_descuento_global,
        validez_dias
    } = req.body;

    const errores = [];

    // ── Items ─────────────────────────────────────────────────────────────────
    if (!Array.isArray(items) || items.length === 0) {
        errores.push('items debe ser un array con al menos un producto.');
    } else {
        // Detectar items duplicados (mismo id_producto + id_presentacion)
        const claves = items.map(
            (i) => `${i.id_producto}::${i.id_presentacion || 'unidad'}`
        );
        const clavesUnicas = new Set(claves);
        if (clavesUnicas.size !== claves.length) {
            errores.push('items contiene productos duplicados. Agrupe en un solo ítem con mayor cantidad.');
        }

        items.forEach((item, idx) => {
            const base = `items[${idx}]`;

            if (!item.id_producto)
                errores.push(`${base}.id_producto es requerido.`);

            if (!item.cantidad || isNaN(parseFloat(item.cantidad)) || parseFloat(item.cantidad) <= 0)
                errores.push(`${base}.cantidad debe ser un número mayor a 0.`);

            if (item.precio_unitario !== undefined) {
                if (isNaN(parseFloat(item.precio_unitario)) || parseFloat(item.precio_unitario) < 0)
                    errores.push(`${base}.precio_unitario inválido (el sistema usará el precio configurado si no se envía).`);
            }

            if (item.monto_descuento !== undefined) {
                if (isNaN(parseFloat(item.monto_descuento)) || parseFloat(item.monto_descuento) < 0)
                    errores.push(`${base}.monto_descuento no puede ser negativo.`);
            }
        });
    }

    // ── Descuento global ──────────────────────────────────────────────────────
    if (tipo_descuento_global !== undefined && tipo_descuento_global !== null) {
        const tiposValidos = ['PORCENTAJE', 'FIJO', 'NINGUNO'];
        if (!tiposValidos.includes(tipo_descuento_global)) {
            errores.push(`tipo_descuento_global debe ser: ${tiposValidos.join(' | ')}.`);
        }
        if (tipo_descuento_global !== 'NINGUNO') {
            if (valor_descuento_global === undefined || valor_descuento_global === null) {
                errores.push('valor_descuento_global es requerido cuando se especifica tipo_descuento_global.');
            } else {
                if (isNaN(parseFloat(valor_descuento_global)) || parseFloat(valor_descuento_global) < 0)
                    errores.push('valor_descuento_global debe ser un número >= 0.');
                if (tipo_descuento_global === 'PORCENTAJE' && parseFloat(valor_descuento_global) > 100)
                    errores.push('El porcentaje de descuento no puede superar 100%.');
            }
        }
    }

    if (validez_dias !== undefined && validez_dias !== null) {
        if (isNaN(parseInt(validez_dias)) || parseInt(validez_dias) <= 0) {
            errores.push('validez_dias debe ser un número entero positivo.');
        }
    }

    if (errores.length > 0) {
        return res.status(400).json({
            status: 400,
            mensaje: 'Error de validación en los datos de la proforma.',
            errores,
        });
    }

    next();
};
