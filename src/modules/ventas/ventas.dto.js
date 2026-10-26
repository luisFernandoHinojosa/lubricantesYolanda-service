// ─── Formato de respuesta de ventas ──────────────────────────────────────────
// Único lugar donde se arma el JSON de una venta: lo usan el listado, el detalle
// y la venta recién creada, así los tres devuelven los mismos campos.
//   - Montos siempre como number con 2 decimales (Postgres devuelve DECIMAL como string).
//   - `total` es lo que se cobró; `total_neto` descuenta devoluciones y suma cambios.
// ─────────────────────────────────────────────────────────────────────────────

const redondear2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const num = (v) => (v === null || v === undefined ? null : redondear2(parseFloat(v)));

const nombreCompleto = (p) =>
    [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ');

// Devoluciones y cambios completados de la venta (la consulta ya filtra los activos).
// En una venta anulada no se consideran: su total_neto es 0.
const totalesDevoluciones = (venta) => {
    let monto_devuelto = 0;
    let diferencia_cambio = 0;
    if (venta.esta_activo) {
        for (const dev of venta.devoluciones || []) {
            if (dev.tipo === 'DEVOLUCION') monto_devuelto += parseFloat(dev.monto_devuelto);
            else if (dev.tipo === 'CAMBIO') diferencia_cambio += parseFloat(dev.monto_diferencia);
        }
    }
    return { monto_devuelto: redondear2(monto_devuelto), diferencia_cambio: redondear2(diferencia_cambio) };
};

const montosVenta = (venta) => {
    const total = num(venta.total);
    const { monto_devuelto, diferencia_cambio } = totalesDevoluciones(venta);
    return {
        subtotal: num(venta.subtotal),
        tipo_descuento_global: venta.tipo_descuento_global,
        valor_descuento_global: num(venta.valor_descuento_global),
        monto_descuento_global: num(venta.monto_descuento_global),
        porcentaje_recargo_iva: num(venta.porcentaje_recargo_iva),
        monto_recargo_iva: num(venta.monto_recargo_iva),
        total,
        monto_devuelto,
        diferencia_cambio,
        total_neto: venta.esta_activo ? redondear2(total - monto_devuelto + diferencia_cambio) : 0,
    };
};

const pagosDTO = (pagos = []) => pagos.map((p) => ({
    metodo_pago: p.metodo_pago,
    monto: num(p.monto),
    referencia: p.referencia || null,
}));

const productoDTO = (p) => (p
    ? {
        id: p.id,
        nombre_comercial: p.nombre_comercial,
        codigo_barras: p.codigo_barras || null,
        unidad_medida: p.unidad_medida
            ? { id: p.unidad_medida.id, nombre: p.unidad_medida.nombre, abreviatura: p.unidad_medida.abreviatura }
            : null,
    }
    : null);

const presentacionDTO = (p) => (p
    ? { id: p.id, nombre: p.nombre, factor_conversion: num(p.factor_conversion) }
    : null);

// En el listado: solo lo necesario para el badge de estado
const facturaResumenDTO = (f) => (f
    ? { estado: f.estado, numero_factura: f.numero_factura, fecha_emision: f.fecha_emision || null }
    : null);

// En el detalle: datos para mostrar/imprimir la factura. No se envían el XML,
// el CUFD ni el ambiente (son de uso interno con el SIAT).
const facturaDetalleDTO = (f, venta) => (f
    ? {
        id: f.id,
        estado: f.estado,
        numero_factura: f.numero_factura,
        cuf: f.cuf || null,
        codigo_control: f.codigo_control || null,
        fecha_emision: f.fecha_emision || null,
        url_factura_pdf: f.url_factura_pdf || null,
        url_siat: f.url_siat || null,
        // Lo que se facturó al SIAT: el total sin el recargo por factura
        monto_facturado: redondear2(parseFloat(venta.total) - parseFloat(venta.monto_recargo_iva || 0)),
        monto_iva: num(f.monto_iva),
        error: f.estado === 'ERROR' ? f.errores_facturacion || null : null,
    }
    : null);

const detalleDTO = (d) => ({
    id: d.id,
    movimiento: d.movimiento,
    producto: productoDTO(d.producto),
    presentacion: presentacionDTO(d.presentacion),
    numero_serie: d.numero_serie || null,
    cantidad: num(d.cantidad),
    precio_unitario: num(d.precio_unitario),
    monto_descuento: num(d.monto_descuento),
    subtotal: num(d.subtotal),
    referencia_comprobante: d.referencia_comprobante || null,
    notas: d.notas || null,
});

export const ventaListadoDTO = (venta) => ({
    id: venta.id,
    numero_comprobante: venta.numero_comprobante,
    fecha: venta.createdAt,
    estado: venta.esta_activo ? 'COMPLETADA' : 'ANULADA',
    id_sesion_caja: venta.id_sesion_caja,
    cliente: venta.cliente
        ? { id: venta.cliente.id, nombre_completo: nombreCompleto(venta.cliente), ci: venta.cliente.ci }
        : null,
    cajero: venta.cajero ? { id: venta.cajero.id, nombre_completo: nombreCompleto(venta.cajero) } : null,
    sucursal: venta.sucursal ? { id: venta.sucursal.id, nombre: venta.sucursal.nombre } : null,
    ...montosVenta(venta),
    pagos: pagosDTO(venta.pagos),
    factura: facturaResumenDTO(venta.factura),
});

// `detalles` son las filas ya armadas por getVentaById (venta + devoluciones + cambios).
// `items_vendidos` son las líneas tal como se vendieron, sin devoluciones: es lo que
// imprime el ticket, y su suma (con descuento global y recargo) cuadra con `total`.
export const ventaDetalleDTO = (venta, detalles) => ({
    ...ventaListadoDTO(venta),
    cliente: venta.cliente
        ? {
            id: venta.cliente.id,
            nombre_completo: nombreCompleto(venta.cliente),
            nombre: venta.cliente.nombre,
            apellido_paterno: venta.cliente.apellido_paterno || null,
            apellido_materno: venta.cliente.apellido_materno || null,
            ci: venta.cliente.ci,
            telefono: venta.cliente.telefono || null,
        }
        : null,
    monto_pagado: num(venta.monto_pagado),
    cambio_entregado: num(venta.cambio_entregado),
    notas: venta.notas || null,
    items_vendidos: (venta.detalles || []).map((d) => detalleDTO({
        id: d.id,
        movimiento: 'VENTA',
        producto: d.producto,
        presentacion: d.presentacion,
        numero_serie: d.numero_serie,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        monto_descuento: d.monto_descuento || 0,
        subtotal: d.subtotal,
    })),
    detalles: detalles.map(detalleDTO),
    factura: facturaDetalleDTO(venta.factura, venta),
});
