// ─────────────────────────────────────────────────────────────────────────────
// THROTTLE para el buscador POS en tiempo real
//
// El cajero puede escribir rápido y cada keystroke dispara una petición.
// Este middleware limita a 1 consulta por usuario cada 150ms,
// cancelando las intermedias para no saturar la BD.
//
// USO: agregar como middleware en la ruta de búsqueda
//   router.get('/', throttleBusqueda, buscarProductos);
// ─────────────────────────────────────────────────────────────────────────────

const busquedasPendientes = new Map();

export const throttleBusqueda = (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const DELAY_MS = 150;

    if (busquedasPendientes.has(userId)) {
        clearTimeout(busquedasPendientes.get(userId));
    }

    const timer = setTimeout(() => {
        busquedasPendientes.delete(userId);
        next();
    }, DELAY_MS);

    busquedasPendientes.set(userId, timer);
};

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT para el endpoint de barcode
//
// Previene abuso del escáner (p.ej. un lector mal configurado que envía
// el mismo barcode en loop). Máximo 30 scans por minuto por usuario.
// ─────────────────────────────────────────────────────────────────────────────

const scanContadores = new Map();

export const rateLimitBarcode = (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const LIMITE = 30;
    const VENTANA = 60 * 1000;

    const ahora = Date.now();
    const entry = scanContadores.get(userId);

    if (!entry || ahora > entry.resetAt) {
        scanContadores.set(userId, { count: 1, resetAt: ahora + VENTANA });
        return next();
    }

    if (entry.count >= LIMITE) {
        return res.status(429).json({
            ok: false,
            mensaje: 'Demasiados escaneos. Espere un momento.',
            retry_after_ms: entry.resetAt - ahora,
        });
    }

    entry.count++;
    next();
};