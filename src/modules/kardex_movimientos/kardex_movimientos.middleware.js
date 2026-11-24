import * as kardexService from './kardex_movimientos.service.js';
import { NotFoundError } from '../../errors/AppError.js';

export const checkKardexMovimientoExists = async (req, _res, next) => {
    try {
        const movimiento = await kardexService.findKardexMovimientoById(req.validated.params.id);
        if (!movimiento) throw new NotFoundError('Movimiento de kardex');
        req.kardexMovimiento = movimiento;
        next();
    } catch (err) {
        next(err);
    }
};
