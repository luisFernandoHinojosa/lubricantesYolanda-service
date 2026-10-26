import db from '../../database/index.js';
import { ForbiddenError } from '../../errors/AppError.js';

const { SesionCaja } = db;

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Verificar que el cajero tiene una sesión de caja ABIERTA.
// Adjunta `req.sesionCaja` para uso posterior en el request.
// ─────────────────────────────────────────────────────────────────────────────
export const requireSesionAbierta = async (req, res, next) => {
    try {
        const { id: id_usuario, id_sucursal } = req.user;
        const empleado = await db.Empleado.findOne({ where: { usuario_id: id_usuario } });
        if (!empleado) {
            throw new ForbiddenError('El usuario no tiene un empleado asociado.');
        }
        const id_empleado = empleado.id;

        const sesion = await SesionCaja.findOne({
            where: { id_empleado, id_sucursal, estado: 'ABIERTA' },
        });

        if (!sesion) {
            throw new ForbiddenError('No hay sesión de caja abierta. Realice la apertura de caja primero.');
        }

        // Disponible en el resto del pipeline
        req.sesionCaja = sesion;
        next();
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Validar apertura de caja.
// ─────────────────────────────────────────────────────────────────────────────
export const validateAperturaCaja = (req, res, next) => {
    const { monto_apertura } = req.body;
    const errores = [];

    if (monto_apertura === undefined || monto_apertura === null) {
        errores.push('monto_apertura es requerido.');
    } else if (parseFloat(monto_apertura) < 0) {
        errores.push('monto_apertura no puede ser negativo.');
    }

    if (errores.length > 0) {
        return res.status(400).json({ status: 400, mensaje: 'Datos de apertura inválidos.', errores });
    }
    next();
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE: Validar cierre de caja.
// ─────────────────────────────────────────────────────────────────────────────
export const validateCierreCaja = (req, res, next) => {
    const { monto_cierre } = req.body;
    const errores = [];

    if (monto_cierre === undefined || monto_cierre === null) {
        errores.push('monto_cierre es requerido.');
    } else if (parseFloat(monto_cierre) < 0) {
        errores.push('monto_cierre no puede ser negativo.');
    }

    if (errores.length > 0) {
        return res.status(400).json({ status: 400, mensaje: 'Datos de cierre inválidos.', errores });
    }
    next();
};