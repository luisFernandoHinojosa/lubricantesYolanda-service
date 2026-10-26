import axios from 'axios';
import { Op, QueryTypes } from 'sequelize';
import db from '../../database/index.js';
import config from '../../config/index.js';
import {
    TIPO_DOCUMENTO_IDENTIDAD,
    METODO_PAGO_SIAT,
    CI_CLIENTE_GENERICO,
    CORREO_CLIENTE_POR_DEFECTO,
} from '../../constants/business.constants.js';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../errors/AppError.js';

const {
    Venta,
    DetalleVenta,
    Producto,
    Categoria,
    UnidadMedida,
    PagoVenta,
    Cliente,
    Factura,
    sequelize,
} = db;

// Secuencia de PostgreSQL creada por src/scripts/migrate_numero_factura.js
const SECUENCIA_NUMERO_FACTURA = 'Facturas_numero_factura_seq';

// ─────────────────────────────────────────────────────────────────────────────
// Siguiente número de factura, asignado por la secuencia de la base de datos.
// nextval() es atómico, así que dos facturas concurrentes nunca reciben el mismo número.
// ─────────────────────────────────────────────────────────────────────────────
export const siguienteNumeroFactura = async (transaction) => {
    const [{ numero }] = await sequelize.query(
        `SELECT nextval('"${SECUENCIA_NUMERO_FACTURA}"')::int AS numero`,
        { type: QueryTypes.SELECT, transaction }
    );
    return numero;
};

// ─────────────────────────────────────────────────────────────────────────────
// Obtiene el código SIAT del método de pago: usa el primer pago del listado
// enviado en la venta (los pagos llegan ordenados por `orden`)
// ─────────────────────────────────────────────────────────────────────────────
const obtenerCodigoMetodoPago = (pagos) => {
    const primerPago = pagos?.[0];
    return METODO_PAGO_SIAT[primerPago?.metodo_pago] || METODO_PAGO_SIAT.EFECTIVO;
};

// Marca la factura con ERROR sin pisar una emisión exitosa de un reintento concurrente
const marcarFacturaConError = (factura, mensaje, extra = {}) => Factura.update(
    { estado: 'ERROR', errores_facturacion: mensaje, ...extra },
    { where: { id: factura.id, estado: { [Op.ne]: 'FACTURADA' } } }
);

// ─────────────────────────────────────────────────────────────────────────────
// Convierte el `message` del proveedor en texto. Puede llegar como string o como
// errores de validación por campo: { phone: ['...'], usuario: ['...'] } → '...; ...'
// ─────────────────────────────────────────────────────────────────────────────
const formatearMensajeProveedor = (message) => {
    if (message === null || message === undefined || message === '') return null;
    if (typeof message !== 'object') return String(message);

    const mensajes = Object.values(message).flat().filter((m) => typeof m === 'string' && m.trim());
    return mensajes.length > 0 ? mensajes.join('; ') : JSON.stringify(message);
};

// ─────────────────────────────────────────────────────────────────────────────
// PRINCIPAL: Emitir factura para una venta existente
// ─────────────────────────────────────────────────────────────────────────────
// El proveedor SIAT acepta como máximo 20 caracteres en el campo `usuario`.
const MAX_LONGITUD_USUARIO = 20;

export const emitirFactura = async (idVenta, nameUser) => {
    const { apiUrl, apiToken, codigoDocumentoSector, leyenda } = config.facturacion;

    // 1. Obtener la venta completa con Cliente, Pagos, Detalles y su Factura
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
                model: Factura,
                as: 'factura',
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
        throw new NotFoundError('Venta', 'Venta no encontrada para facturar.');
    }

    // Evita emitir una segunda factura fiscal para la misma venta
    if (venta.factura?.estado === 'FACTURADA') {
        throw new ConflictError(
            `La venta ${venta.numero_comprobante} ya fue facturada (factura N° ${venta.factura.numero_factura}).`
        );
    }

    // 2. Extraer datos fiscales del cliente (debe tener CI/NIT, no el cliente genérico)
    const cliente = venta.cliente;
    if (!cliente?.ci || cliente.ci === CI_CLIENTE_GENERICO) {
        throw new BusinessRuleError(
            'Para facturar, la venta debe tener un cliente con CI/NIT.',
            'CLIENTE_REQUERIDO_PARA_FACTURAR'
        );
    }
    const razonSocial = cliente.nombreCompleto || 'SIN NOMBRE';
    const numeroDocumento = String(cliente.ci);
    // Código tipo documento SIAT: 1=CI, 2=CEX, 3=PAS, 4=OD, 5=NIT
    const tipoDocumento = cliente.tipo_documento || TIPO_DOCUMENTO_IDENTIDAD.CI;
    const complemento = cliente.complemento || null;

    // 3. Factura de la venta. Si se registró sin facturar, se crea ahora con el siguiente
    //    número de la secuencia; en un reintento se reutiliza el número ya asignado.
    const factura = venta.factura || await Factura.create({
        id_venta: venta.id,
        estado: 'PENDIENTE',
        numero_factura: await siguienteNumeroFactura(),
    });
    const numeroFactura = factura.numero_factura;

    // Validar configuración de credenciales del servicio de facturación
    if (!apiUrl || !apiToken) {
        await marcarFacturaConError(
            factura,
            'Facturación no configurada: falta FACTURACION_API_URL o FACTURACION_API_TOKEN.'
        );
        console.warn('[Facturación] No configurada. Faltan variables de entorno.');
        return {
            success: false,
            error: 'Facturación no configurada en el servidor (faltan variables de entorno).',
        };
    }

    // name_user del usuario en sesión (req.user), recortado al límite del SIAT
    const usuario = (nameUser || config.facturacion.usuario || '').trim().slice(0, MAX_LONGITUD_USUARIO);
    if (!usuario) {
        const mensaje = 'Facturación sin usuario: el usuario en sesión no tiene nombre y falta FACTURACION_USUARIO.';
        await marcarFacturaConError(factura, mensaje);
        console.warn(`[Facturación] ${mensaje}`);
        return { success: false, error: mensaje };
    }

    // 4. Calcular montos
    // El recargo por factura (monto_recargo_iva) lo cobra el negocio y no va en la factura:
    // montoTotal debe coincidir con la suma del detalle menos el descuento adicional.
    const montoTotal = Math.round(
        (parseFloat(venta.total) - parseFloat(venta.monto_recargo_iva || 0)) * 100
    ) / 100;
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
        email: cliente.correo_electronico || CORREO_CLIENTE_POR_DEFECTO,
        // Tal como está registrado; el proveedor exige código de país y solo dígitos
        phone: cliente.telefono,
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

        // 9. El proveedor puede responder HTTP 200 con un rechazo: solo es éxito si el SIAT la validó
        const body = respuesta.data || {};
        const resData = body.data;
        if (body.transaccion !== true || body.siatRespuesta !== 'VALIDA' || !resData) {
            const mensajeError = formatearMensajeProveedor(body.message)
                || `El SIAT respondió: ${body.siatRespuesta ?? 'sin respuesta'}`;

            await marcarFacturaConError(factura, mensajeError, { estado_siat: body.siatRespuesta ?? null });

            console.error(`[Facturación] Factura #${numeroFactura} rechazada para venta ${venta.numero_comprobante}:`, mensajeError);

            return {
                success: false,
                error: mensajeError,
            };
        }

        // 10. Éxito → Actualizar Factura
        const montoIva = montoTotal * (config.facturacion.ivaPorcentaje / 100);

        await factura.update({
            estado: 'FACTURADA',
            estado_siat: body.siatRespuesta,
            cuf: resData.cuf || null,
            cufd: resData.cufd || null,
            codigo_control: resData.codigoControl || null,
            codigo_ambiente: resData.codigoAmbiente ?? null,
            url_factura_pdf: resData.urlFactura || null,
            url_siat: resData.urlSiat || null,
            xml_factura: resData.xml || null,
            monto_iva: montoIva,
            fecha_emision: new Date(),
            errores_facturacion: null,
        });

        console.log(`[Facturación] Factura #${numeroFactura} emitida exitosamente. CUF: ${resData.cuf}`);

        return {
            success: true,
            numeroFactura,
            cuf: resData.cuf || null,
            urlPdf: resData.urlFactura || null,
            urlSiat: resData.urlSiat || null,
        };
    } catch (error) {
        // 11. Error HTTP o de red → Guardar detalle del error en Factura sin tirar excepción que aborte la venta
        const data = error.response?.data;
        const mensajeError = formatearMensajeProveedor(data?.message)
            || formatearMensajeProveedor(data?.mensaje)
            || formatearMensajeProveedor(data?.error)
            || formatearMensajeProveedor(data)
            || error.message;

        await marcarFacturaConError(factura, mensajeError);

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
