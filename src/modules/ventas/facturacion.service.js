import axios from 'axios';
import db from '../../database/index.js';
import config from '../../config/index.js';
import { TIPO_DOCUMENTO_IDENTIDAD, METODO_PAGO_SIAT } from '../../constants/business.constants.js';

const {
    Venta,
    DetalleVenta,
    Producto,
    Categoria,
    UnidadMedida,
    PagoVenta,
    Cliente,
    Factura,
} = db;

// ─────────────────────────────────────────────────────────────────────────────
// Genera un número de factura correlativo (autoincremental por el máximo en Facturas)
// ─────────────────────────────────────────────────────────────────────────────
const generarNumeroFactura = async () => {
    const ultima = await Factura.max('numero_factura');
    return (ultima || 0) + 1;
};

// ─────────────────────────────────────────────────────────────────────────────
// Obtiene el código SIAT del método de pago: usa el primer pago del listado
// enviado en la venta (los pagos llegan ordenados por `orden`)
// ─────────────────────────────────────────────────────────────────────────────
const obtenerCodigoMetodoPago = (pagos) => {
    const primerPago = pagos?.[0];
    return METODO_PAGO_SIAT[primerPago?.metodo_pago] || METODO_PAGO_SIAT.EFECTIVO;
};

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPAL: Emitir factura para una venta existente
// ─────────────────────────────────────────────────────────────────────────────
// El proveedor SIAT acepta como máximo 20 caracteres en el campo `usuario`.
const MAX_LONGITUD_USUARIO = 20;

export const emitirFactura = async (idVenta, nameUser) => {
    const { apiUrl, apiToken, codigoDocumentoSector, leyenda } = config.facturacion;

    // Obtener o crear el registro de Factura asociado
    const [factura] = await Factura.findOrCreate({
        where: { id_venta: idVenta },
        defaults: { estado: 'PENDIENTE' },
    });

    // Validar configuración de credenciales del servicio de facturación
    if (!apiUrl || !apiToken) {
        await factura.update({
            estado: 'ERROR',
            errores_facturacion: 'Facturación no configurada: falta FACTURACION_API_URL o FACTURACION_API_TOKEN.',
        });
        console.warn('[Facturación] No configurada. Faltan variables de entorno.');
        return {
            success: false,
            error: 'Facturación no configurada en el servidor (faltan variables de entorno).',
        };
    }

    // name_user del usuario en sesión (req.user), recortado al límite del SIAT
    const usuario = (nameUser || config.facturacion.usuario || '').slice(0, MAX_LONGITUD_USUARIO);

    // 1. Obtener la venta completa con Cliente, Pagos y Detalles
    const venta = await Venta.findByPk(idVenta, {
        include: [
            {
                model: Cliente,
                as: 'cliente',
            },
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
        order: [[{ model: PagoVenta, as: 'pagos' }, 'orden', 'ASC']],
    });

    if (!venta) {
        throw Object.assign(new Error('Venta no encontrada para facturar.'), { statusCode: 404 });
    }

    // 2. Extraer datos fiscales del cliente
    const cliente = venta.cliente;
    const razonSocial = cliente?.nombreCompleto || 'SIN NOMBRE';
    const numeroDocumento = String(cliente?.ci || '0');
    // Código tipo documento SIAT: 1=CI, 2=CEX, 3=PAS, 4=OD, 5=NIT
    const tipoDocumento = cliente?.tipo_documento || TIPO_DOCUMENTO_IDENTIDAD.CI;
    const complemento = cliente?.complemento || null;

    // 3. Generar número correlativo de factura
    const numeroFactura = await generarNumeroFactura();

    // 4. Calcular montos
    const montoTotal = parseFloat(venta.total);
    const descuentoAdicional = parseFloat(venta.monto_descuento_global || 0);
    const montoTotalSujetoIva = montoTotal;

    // 5. Obtener código de método de pago
    const codigoMetodoPago = obtenerCodigoMetodoPago(venta.pagos);

    // 6. Armar el detalle mapeando cada item
    const detalle = (venta.detalles || []).map((det) => {
        const producto = det.producto || {};
        const categoria = producto.categoria || {};
        const unidadMedida = producto.unidad_medida || {};

        return {
            actividadEconomica: categoria.siat_codigo_actividad || '',
            codigoProductoSin: categoria.siat_codigo_producto || '',
            codigoProducto: producto.codigo_barras || producto.id,
            descripcion: producto.nombre_comercial || 'Producto',
            cantidad: parseFloat(det.cantidad),
            unidadMedida: unidadMedida.codigo_fact || '58',
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
        numeroDocumento,
        complemento,
        codigoCliente: numeroDocumento,
        codigoMetodoPago,
        montoTotal,
        montoTotalSujetoIva,
        descuentoAdicional,
        leyenda,
        usuario,
        codigoDocumentoSector,
        email: cliente?.correo_electronico || null,
        detalle,
    };

    // 8. Llamar al proveedor SIAT
    try {
        console.log(`[Facturación] Emitiendo factura #${numeroFactura} para venta ${venta.numero_comprobante}...`);

        const respuesta = await axios.post(apiUrl + '/factura/insert', payloadProveedor, {
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 80000, // 80 segundos
        });

        // 9. Éxito → Actualizar Factura
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
            numeroFactura,
            cuf: cufFinal,
            urlPdf: urlFinal,
        };
    } catch (error) {
        // 10. Error → Guardar detalle del error en Factura sin tirar excepción que aborte la venta
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
export const reintentarFactura = async (idVenta, nameUser) => {
    return emitirFactura(idVenta, nameUser);
};
