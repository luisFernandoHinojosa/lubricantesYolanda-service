import axios from 'axios';
import db from '../../database/index.js';
import config from '../../config/index.js';

const {
    Venta,
    DetalleVenta,
    Producto,
    Categoria,
    UnidadMedida,
    PagoVenta,
    Cliente,
    Usuario,
    Factura,
} = db;

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo de métodos de pago internos → código SIN
// ─────────────────────────────────────────────────────────────────────────────
const METODO_PAGO_SIN = {
    EFECTIVO: 1,
    TARJETA: 2,
    TRANSFERENCIA: 4,
    VALE: 4,
    QR: 7,
    CHEQUE: 3,
    OTRO: 1, // fallback
};

// ─────────────────────────────────────────────────────────────────────────────
// Genera un número de factura correlativo (autoincremental por el máximo existente)
// ─────────────────────────────────────────────────────────────────────────────
const generarNumeroFactura = async () => {
    const ultima = await Venta.max('numero_factura');
    return (ultima || 0) + 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// Obtiene el código de método de pago SIN a partir de los pagos de la venta
// Usa el método de pago con mayor monto como el principal
// ─────────────────────────────────────────────────────────────────────────────
const obtenerCodigoMetodoPago = (pagos) => {
    if (!pagos || pagos.length === 0) return 1;

    // Si hay un solo pago, usar ese
    if (pagos.length === 1) {
        return METODO_PAGO_SIN[pagos[0].metodo_pago] || 1;
    }

    // Si hay varios, usar el de mayor monto
    const pagoPrincipal = pagos.reduce((prev, curr) =>
        parseFloat(curr.monto) > parseFloat(prev.monto) ? curr : prev
    );
    return METODO_PAGO_SIN[pagoPrincipal.metodo_pago] || 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPAL: Emitir factura para una venta existente
// ─────────────────────────────────────────────────────────────────────────────
export const emitirFactura = async (idVenta, id_usuario) => {
    const { apiUrl, apiToken, codigoDocumentoSector, leyenda } = config.facturacion;

    // Obtener el name_user del usuario en sesión
    let usuario = config.facturacion.usuario; // fallback al .env
    if (id_usuario) {
        const usuarioDb = await Usuario.findByPk(id_usuario, { attributes: ['name_user'] });
        if (usuarioDb) usuario = usuarioDb.name_user;
    }

    if (!apiUrl || !apiToken) {
        // Upsert simple de Factura en error si no hay config
        const [facturaError] = await Factura.findOrCreate({
            where: { id_venta: idVenta },
            defaults: { estado: 'ERROR', errores_facturacion: 'Facturación no configurada: falta FACTURACION_API_URL o FACTURACION_API_TOKEN.' }
        });
        if (!facturaError.isNewRecord) {
            await facturaError.update({ estado: 'ERROR', errores_facturacion: 'Facturación no configurada.' });
        }
        console.error('[Facturación] No configurada. Faltan variables de entorno.');
        return null;
    }

    // 1. Obtener la venta completa con sus relaciones
    const venta = await Venta.findByPk(idVenta, {
        include: [
            {
                model: PagoVenta,
                as: 'pagos',
            },
            {
                model: DetalleVenta,
                as: 'detalles',
                include: [
                    {
                        model: Producto,
                        as: 'producto',
                        include: [
                            { model: Categoria, as: 'categoria' },
                            { model: UnidadMedida, as: 'unidad_medida' },
                        ],
                    },
                ],
            },
        ],
    });

    if (!venta) {
        throw Object.assign(new Error('Venta no encontrada para facturar.'), { statusCode: 404 });
    }

    // 2. Usar los datos de facturación guardados o los recibidos
    const datos = datosFacturacion || venta.datos_facturacion_cliente;
    if (!datos) {
        await venta.update({
            estado_facturacion: 'ERROR',
            errores_facturacion: 'No se encontraron datos de facturación del cliente.',
        });
        throw Object.assign(new Error('Datos de facturación del cliente no disponibles.'), { statusCode: 400 });
    }

    // 3. Generar número de factura
    const numeroFactura = await generarNumeroFactura();

    // 4. Calcular montos
    const montoTotal = parseFloat(venta.total);
    const descuentoAdicional = parseFloat(venta.monto_descuento_global || 0);
    const montoTotalSujetoIva = montoTotal;

    // 5. Obtener código de método de pago
    const codigoMetodoPago = obtenerCodigoMetodoPago(venta.pagos);

    // 6. Armar el detalle mapeando cada item
    const detalle = venta.detalles.map((det) => {
        const producto = det.producto;
        const categoria = producto.categoria;
        const unidadMedida = producto.unidad_medida;

        return {
            actividadEconomica: categoria.siat_codigo_actividad,
            codigoProductoSin: categoria.siat_codigo_producto,
            codigoProducto: producto.codigo_producto || producto.codigo_barras || producto.id,
            descripcion: producto.nombre_comercial,
            cantidad: parseFloat(det.cantidad),
            unidadMedida: unidadMedida.codigo_fact,
            precioUnitario: parseFloat(det.precio_unitario),
            montoDescuento: parseFloat(det.monto_descuento || 0),
            subTotal: parseFloat(det.subtotal),
        };
    });

    // 7. Armar el payload completo del proveedor
    const payloadProveedor = {
        numeroFactura,
        nombreRazonSocial: razonSocial,
        codigoTipoDocumentoIdentidad: tipoDocumento,
        numeroDocumento: numeroDocumento,
        complemento: null,
        codigoCliente: numeroDocumento,
        codigoMetodoPago,
        montoTotal,
        montoTotalSujetoIva,
        descuentoAdicional,
        leyenda,
        usuario: usuario || config.facturacion.usuario,
        codigoDocumentoSector,
        email: cliente.correo_electronico || null,
        detalle,
    };

    // 8. Llamar al proveedor
    try {
        console.log(`[Facturación] Emitiendo factura #${numeroFactura} para venta ${venta.numero_comprobante}...`);

        const respuesta = await axios.post(apiUrl, payloadProveedor, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 segundos
        });

        // 9. Éxito → Actualizar la venta
        const resData = respuesta.data.data || {};
        const cufFinal = resData.cuf || null;
        const urlFinal = resData.urlSiat || resData.urlPdf || null;
        const xmlFinal = resData.xml || null;
        const montoIva = montoTotal * (config.facturacion.ivaPorcentaje / 100);

        await factura.update({
            estado: 'FACTURADA',
            numero_factura: numeroFactura,
            cuf: cufFinal,
            url_factura_pdf: urlFinal,
            xml_factura: xmlFinal,
            monto_iva: montoIva,
            errores_facturacion: null,
        });

        console.log(`[Facturación] Factura #${numeroFactura} emitida exitosamente. CUF: ${cufFinal}`);

        return {
            success: true,
            numeroFactura: numeroFactura,
            cuf: cufFinal,
            urlPdf: urlFinal,
        };
    } catch (error) {
        // 10. Error → Marcar la venta pero NO lanzar excepción (la venta ya está guardada)
        const mensajeErrorRaw = error.response?.data?.mensaje
            || error.response?.data?.message
            || error.response?.data?.error
            || error.response?.data
            || error.message;

        const mensajeError = typeof mensajeErrorRaw === 'object'
            ? JSON.stringify(mensajeErrorRaw)
            : String(mensajeErrorRaw);

        await factura.update({
            estado: 'ERROR',
            errores_facturacion: mensajeError,
        });

        console.error(`[Facturación] Error al emitir factura para venta ${venta.numero_comprobante}:`, mensajeError);

        return {
            success: false,
            error: mensajeError,
        };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Reintentar facturación de una venta con estado ERROR o PENDIENTE
// ─────────────────────────────────────────────────────────────────────────────
export const reintentarFactura = async (idVenta, id_usuario) => {
    return emitirFactura(idVenta, id_usuario);
};
