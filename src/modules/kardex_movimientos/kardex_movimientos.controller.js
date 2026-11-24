import * as kardexService from './kardex_movimientos.service.js';

export class KardexMovimientoController {
    list = async (req, res, next) => {
        try {
            const data = await kardexService.findAllKardexMovimientos(req.validated.query);
            res.status(200).json({ status: 'success', data });
        } catch (err) {
            next(err);
        }
    };

    getById = async (req, res, next) => {
        try {
            res.status(200).json({ status: 'success', data: req.kardexMovimiento });
        } catch (err) {
            next(err);
        }
    };

    tarjeta = async (req, res, next) => {
        try {
            const { params, query } = req.validated;
            const data = await kardexService.getTarjetaKardex(params.id_producto, query);
            res.status(200).json({ status: 'success', data });
        } catch (err) {
            next(err);
        }
    };
}

export const kardexMovimientoController = new KardexMovimientoController();
