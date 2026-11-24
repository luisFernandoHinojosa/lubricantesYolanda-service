import * as kardexRepository from './kardex_movimientos.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { inicioDelDia, finDelDia } from '../../utils/fechas.js';

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

// El documento de origen hoy solo vive en la observación (p. ej. "Venta TK-0001-20261021-0001",
// "Ingreso por compra comprobante #F-123"). Se extrae como mejor esfuerzo.
const extraerDocumento = (tipo, observacion) => {
    if (!observacion) return null;
    const venta = observacion.match(/Venta\s+(\S+)/i);
    if (venta) {
        const tipoDoc = tipo === 'DEVOLUCION' ? 'DEVOLUCION' : tipo === 'ANULACION' ? 'ANULACION' : 'VENTA';
        return { tipo: tipoDoc, numero: venta[1] };
    }
    const compra = observacion.match(/compra comprobante\s*#\s*(\S+)/i);
    if (compra) return { tipo: 'COMPRA', numero: compra[1] };
    return null;
};

const armarUbicacion = (row, lado) => {
    const id = row[`${lado}_id`];
    if (!id) return null;
    const sucursal = row[`${lado}_sucursal`];
    const fisica = row[`${lado}_fisica`];
    const nombre = row[`${lado}_nombre`];
    return {
        id,
        nombre,
        tipo_area: row[`${lado}_tipo_area`],
        sucursal: sucursal ? { id: row[`${lado}_sucursal_id`], nombre: sucursal } : null,
        ubicacion_fisica: fisica ? { id: row[`${lado}_fisica_id`], nombre: fisica } : null,
        descripcion: [sucursal, nombre, fisica].filter(Boolean).join(' › '),
    };
};

const aDTO = (row) => {
    const dto = {
        id: row.id,
        fecha: row.fecha,
        tipo_movimiento: row.tipo_movimiento,
        naturaleza: row.naturaleza,
        cantidad: redondear(row.cantidad),
        entrada: redondear(row.entrada),
        salida: redondear(row.salida),
        cantidad_signada: redondear(row.neto),
        costo_unitario: redondear(row.costo_unitario),
        valor_total: redondear(row.valor_total),
        producto: {
            id: row.id_producto,
            nombre: row.producto_nombre,
            sku: row.producto_sku,
            codigo_producto: row.codigo_producto,
            codigo_barras: row.codigo_barras,
            marca: row.marca,
            categoria: row.categoria,
            unidad: row.unidad_abreviatura || row.unidad_nombre || null,
        },
        lote: {
            id: row.id_lote,
            codigo: row.codigo_lote,
            fecha_vencimiento: row.fecha_vencimiento,
            proveedor: row.id_proveedor ? { id: row.id_proveedor, nombre: row.proveedor } : null,
        },
        origen: armarUbicacion(row, 'origen'),
        destino: armarUbicacion(row, 'destino'),
        usuario: row.id_usuario
            ? { id: row.id_usuario, nombre: row.usuario_nombre || row.usuario_username || 'Usuario' }
            : null,
        documento: extraerDocumento(row.tipo_movimiento, row.observacion),
        observacion: row.observacion,
    };

    if (row.saldo !== undefined) {
        dto.saldo = redondear(row.saldo);
        dto.saldo_valorizado = redondear(row.saldo_valorizado);
    }
    return dto;
};

const paginar = (query) => {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    return { page, perPage, limit: perPage, offset: (page - 1) * perPage };
};

const construirFiltros = (query) => ({
    ...query,
    inicio: query.desde ? inicioDelDia(query.desde) : undefined,
    fin: query.hasta ? finDelDia(query.hasta) : undefined,
});

export const findAllKardexMovimientos = async (query) => {
    const { page, perPage, limit, offset } = paginar(query);
    const { rows, resumen } = await kardexRepository.listar(construirFiltros(query), {
        limit,
        offset,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
    });

    const total = resumen.total;
    return {
        kardexMovimientos: rows.map(aDTO),
        total,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
        resumen: {
            entradas: resumen.entradas,
            salidas: resumen.salidas,
            neutros: resumen.neutros,
            valor_entradas: redondear(resumen.valor_entradas),
            valor_salidas: redondear(resumen.valor_salidas),
        },
    };
};

export const findKardexMovimientoById = async (id) => {
    const row = await kardexRepository.buscarPorId(id);
    return row ? aDTO(row) : null;
};

export const getTarjetaKardex = async (id_producto, query) => {
    const producto = await kardexRepository.buscarProducto(id_producto);
    if (!producto) throw new NotFoundError('Producto');

    const { page, perPage, limit, offset } = paginar(query);
    const filtros = construirFiltros({ ...query, id_producto });

    const [{ rows, total, resumen }, stockSistema, lotes] = await Promise.all([
        kardexRepository.tarjeta(filtros, { limit, offset, sortOrder: query.sortOrder }),
        kardexRepository.stockSistema(filtros),
        kardexRepository.lotesDeProducto(id_producto),
    ]);

    const saldoInicial = redondear(resumen.saldo_inicial);
    const totalEntradas = redondear(resumen.total_entradas);
    const totalSalidas = redondear(resumen.total_salidas);
    const valorInicial = redondear(resumen.valor_inicial);
    const valorEntradas = redondear(resumen.valor_entradas);
    const valorSalidas = redondear(resumen.valor_salidas);
    const saldoHistorico = redondear(resumen.saldo_historico);
    const stock = redondear(stockSistema);
    const diferencia = redondear(stock - saldoHistorico);

    return {
        producto: {
            id: producto.id,
            nombre: producto.nombre_comercial,
            sku: producto.sku,
            codigo_producto: producto.codigo_producto,
            codigo_barras: producto.codigo_barras,
            imagen_url: producto.imagen_url,
            stock_minimo: producto.stock_minimo,
            maneja_vencimiento: producto.maneja_vencimiento,
            marca: producto.marca?.nombre ?? null,
            categoria: producto.categoria?.nombre ?? null,
            unidad: producto.unidad_medida?.abreviatura || producto.unidad_medida?.nombre || null,
        },
        lotes: lotes.map((l) => ({
            id: l.id,
            codigo: l.codigo_lote,
            fecha_vencimiento: l.fecha_vencimiento,
            esta_activo: l.esta_activo,
        })),
        periodo: { desde: query.desde ?? null, hasta: query.hasta ?? null },
        resumen: {
            saldo_inicial: saldoInicial,
            total_entradas: totalEntradas,
            total_salidas: totalSalidas,
            saldo_final: redondear(saldoInicial + totalEntradas - totalSalidas),
            valor_inicial: valorInicial,
            valor_entradas: valorEntradas,
            valor_salidas: valorSalidas,
            valor_final: redondear(valorInicial + valorEntradas - valorSalidas),
            movimientos: resumen.movimientos,
        },
        // Compara el saldo acumulado de todo el historial del kardex con el stock real
        cuadre: {
            saldo_kardex: saldoHistorico,
            stock_sistema: stock,
            diferencia,
            cuadra: Math.abs(diferencia) < 0.01,
        },
        movimientos: rows.map(aDTO),
        total,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
};
