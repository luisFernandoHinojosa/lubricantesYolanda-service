import { Op } from 'sequelize';
import { fechaLocal } from '../../utils/fechas.js';

// ─── Stock vendible ──────────────────────────────────────────────────────────
// Condiciones del stock que se puede vender en una sucursal. El POS (catalogo_pos)
// y la venta (ventas.service) usan las mismas, así el stock que ve el cajero es el
// mismo del que se descuenta:
//   - registro de stock activo y con cantidad > 0
//   - lote activo (un lote inactivo no se vende)
//   - si el producto maneja vencimiento, lote sin vencer (o sin fecha de vencimiento)
//   - ubicación activa de la sucursal
// ─────────────────────────────────────────────────────────────────────────────

export const whereStockVendible = () => ({
    cantidad_actual: { [Op.gt]: 0 },
    esta_activo: true,
});

// `productos`: [{ id, maneja_vencimiento }] (al menos uno)
export const whereLoteVendible = (productos) => {
    const conVencimiento = productos.filter((p) => p.maneja_vencimiento).map((p) => p.id);
    const sinVencimiento = productos.filter((p) => !p.maneja_vencimiento).map((p) => p.id);
    // fecha_vencimiento es DATEONLY: se compara contra el día de Bolivia como string
    const hoy = fechaLocal();

    return {
        esta_activo: true,
        [Op.or]: [
            ...(sinVencimiento.length > 0 ? [{ id_producto: sinVencimiento }] : []),
            ...(conVencimiento.length > 0
                ? [{
                    id_producto: conVencimiento,
                    [Op.or]: [{ fecha_vencimiento: null }, { fecha_vencimiento: { [Op.gte]: hoy } }],
                }]
                : []),
        ],
    };
};

export const whereUbicacionVendible = (id_sucursal) => ({
    id_sucursal,
    esta_activo: true,
});
