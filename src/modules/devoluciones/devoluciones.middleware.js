// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Validar body de una devolución
// ─────────────────────────────────────────────────────────────────────────────
export const validateDevolucion = (req, res, next) => {
    const { id_venta, id_sesion_caja, items, motivo, metodo_reembolso } = req.body;
    const errores = [];

    if (!id_venta) errores.push('id_venta es requerido.');
    if (!id_sesion_caja) errores.push('id_sesion_caja es requerido.');

    if (!Array.isArray(items) || items.length === 0) {
        errores.push('items debe ser un array con al menos un producto a devolver.');
    } else {
        items.forEach((item, idx) => {
            const base = `items[${idx}]`;
            if (!item.id_detalle_venta)
                errores.push(`${base}.id_detalle_venta es requerido.`);
            if (!item.cantidad_devuelta || isNaN(parseFloat(item.cantidad_devuelta)) || parseFloat(item.cantidad_devuelta) <= 0)
                errores.push(`${base}.cantidad_devuelta debe ser un número mayor a 0.`);
        });
    }

    if (metodo_reembolso && !['EFECTIVO', 'CREDITO'].includes(metodo_reembolso)) {
        errores.push('metodo_reembolso debe ser EFECTIVO o CREDITO.');
    }

    if (errores.length > 0) {
        return res.status(400).json({
            status: 400,
            mensaje: 'Error de validación en los datos de la devolución.',
            errores,
        });
    }

    next();
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Validar body de un cambio de producto
// ─────────────────────────────────────────────────────────────────────────────
export const validateCambio = (req, res, next) => {
    const { id_venta, id_sesion_caja, items, motivo, metodo_reembolso } = req.body;
    const errores = [];

    if (!id_venta) errores.push('id_venta es requerido.');
    if (!id_sesion_caja) errores.push('id_sesion_caja es requerido.');

    if (!Array.isArray(items) || items.length === 0) {
        errores.push('items debe ser un array con al menos un producto a cambiar.');
    } else {
        items.forEach((item, idx) => {
            const base = `items[${idx}]`;

            // Producto a devolver
            if (!item.id_detalle_venta)
                errores.push(`${base}.id_detalle_venta es requerido.`);
            if (!item.cantidad_devuelta || isNaN(parseFloat(item.cantidad_devuelta)) || parseFloat(item.cantidad_devuelta) <= 0)
                errores.push(`${base}.cantidad_devuelta debe ser un número mayor a 0.`);

            // Producto nuevo
            if (!item.id_producto_nuevo)
                errores.push(`${base}.id_producto_nuevo es requerido.`);
            if (!item.cantidad_nueva || isNaN(parseFloat(item.cantidad_nueva)) || parseFloat(item.cantidad_nueva) <= 0)
                errores.push(`${base}.cantidad_nueva debe ser un número mayor a 0.`);
        });
    }

    if (metodo_reembolso && !['EFECTIVO', 'CREDITO'].includes(metodo_reembolso)) {
        errores.push('metodo_reembolso debe ser EFECTIVO o CREDITO.');
    }

    if (errores.length > 0) {
        return res.status(400).json({
            status: 400,
            mensaje: 'Error de validación en los datos del cambio.',
            errores,
        });
    }

    next();
};
