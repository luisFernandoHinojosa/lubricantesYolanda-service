// ─── VALIDAR PARÁMETRO DE BÚSQUEDA ───────────────────────────────────────────
export const validateQueryBusqueda = (req, res, next) => {
    const { q } = req.query;
    if (!q || q.trim().length < 1) {
        return res.status(400).json({
            status: 400,
            mensaje: 'El parámetro "q" es requerido y debe tener al menos 1 carácter.',
        });
    }
    next();
};

// ─── VALIDAR CÓDIGO DE BARRAS ─────────────────────────────────────────────────
export const validateBarcode = (req, res, next) => {
    const { codigo } = req.params;
    if (!codigo || codigo.trim().length === 0) {
        return res.status(400).json({
            status: 400,
            mensaje: 'El código de barras no puede estar vacío.',
        });
    }
    next();
};

// ─── VALIDAR PARÁMETROS DE CANTIDAD ──────────────────────────────────────────
export const validateCantidad = (req, res, next) => {
    const { cantidad } = req.query;
    if (cantidad !== undefined && (isNaN(parseFloat(cantidad)) || parseFloat(cantidad) <= 0)) {
        return res.status(400).json({
            status: 400,
            mensaje: 'El parámetro "cantidad" debe ser un número mayor a 0.',
        });
    }
    next();
};