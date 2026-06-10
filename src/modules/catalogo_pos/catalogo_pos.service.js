import { Op, where, fn, col } from 'sequelize';
import db from '../../database/index.js';

const { Producto, Presentacion, Lote, StockDistribucion, Ubicacion, ProductoSerie, UnidadMedida } = db;

const DIAS_ALERTA_VENCIMIENTO = 30;

const getStock = async (producto, id_sucursal) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const filtroFecha = {};
    if (producto.maneja_vencimiento) {
        filtroFecha[Op.or] = [
            { fecha_vencimiento: null },
            { fecha_vencimiento: { [Op.gte]: hoy } },
        ];
    }

    const lotesConStock = await Lote.findAll({
        where: { id_producto: producto.id, ...filtroFecha },
        include: [
            {
                model: StockDistribucion,
                as: 'stock_distribuciones',
                where: { cantidad_actual: { [Op.gt]: 0 } },
                required: true,
                include: [
                    {
                        model: Ubicacion,
                        as: 'ubicacion',
                        where: { id_sucursal, esta_activo: true },
                        required: true,
                    },
                ],
            },
        ],
        order: [['fecha_ingreso', 'DESC']], // Más reciente primero para precio
    });

    if (lotesConStock.length === 0) {
        return { stockDisponible: 0, alertaVencimiento: false, lotesProximosVencer: [] };
    }

    // Stock total sumando todos los registros de StockDistribucion
    const stockDisponible = lotesConStock.reduce(
        (acc, lote) =>
            acc + lote.stock_distribuciones.reduce((a, sd) => a + parseFloat(sd.cantidad_actual), 0),
        0
    );

    // Precio: del lote más reciente que tenga precio_venta_sugerido
    // const loteConPrecio = lotesConStock.find((l) => l.precio_venta_sugerido != null);
    // const precioVenta = loteConPrecio ? parseFloat(loteConPrecio.precio_venta_sugerido) : null;

    // Alerta de vencimiento (solo si el producto lo maneja)
    const lotesProximosVencer = [];
    if (producto.maneja_vencimiento) {
        const fechaLimite = new Date(hoy);
        fechaLimite.setDate(fechaLimite.getDate() + DIAS_ALERTA_VENCIMIENTO);

        for (const lote of lotesConStock) {
            if (lote.fecha_vencimiento && new Date(lote.fecha_vencimiento) <= fechaLimite) {
                const stockLote = lote.stock_distribuciones.reduce(
                    (a, sd) => a + parseFloat(sd.cantidad_actual), 0
                );
                lotesProximosVencer.push({
                    codigo_lote: lote.codigo_lote,
                    fecha_vencimiento: lote.fecha_vencimiento,
                    stock: stockLote,
                });
            }
        }
    }

    return { stockDisponible, alertaVencimiento: lotesProximosVencer.length > 0, lotesProximosVencer };
};

// ─── HELPER: construye el objeto que recibe el frontend ───────────────────────
const formatearParaPOS = async (producto, id_sucursal) => {
    const { stockDisponible, alertaVencimiento, lotesProximosVencer } =
        await getStock(producto, id_sucursal);

    const presentaciones = (producto.presentaciones || [])
        .filter((p) => p.esta_activo)
        .map((p) => {
            const factor = parseFloat(p.factor_conversion);
            return {
                id: p.id,
                nombre: p.nombre,
                factor_conversion: factor,
                precio_especial: parseFloat(p.precio_especial),
                codigo_barras: p.codigo_barras || null,
                stock_disponible: Math.floor(stockDisponible / factor),
                id_unidad_medida: p.id_unidad_medida,
                unidad_medida_nombre: p.unidad_medida?.nombre || null,
                unidad_medida_abreviatura: p.unidad_medida?.abreviatura || null,
            };
        });

    return {
        id: producto.id,
        codigo_barras: producto.codigo_barras || null,
        nombre_comercial: producto.nombre_comercial,
        maneja_serie: producto.maneja_serie,
        maneja_vencimiento: producto.maneja_vencimiento,
        stock_minimo: producto.stock_minimo,
        precio_venta: parseFloat(producto.precio_venta),
        stock_disponible: stockDisponible,
        disponible: stockDisponible > 0 && producto.precio_venta !== null,
        stock_bajo: stockDisponible > 0 && stockDisponible <= producto.stock_minimo,
        alerta_vencimiento: alertaVencimiento,
        lotes_proximos_vencer: lotesProximosVencer,
        imagen_url: producto.imagen_url || null,
        id_unidad_medida: producto.id_unidad_medida,
        unidad_medida_nombre: producto.unidad_medida?.nombre || null,
        unidad_medida_abreviatura: producto.unidad_medida?.abreviatura || null,
        presentaciones,
    };
};

// Includes reutilizables para no repetirlos en cada función
const INCLUDES_POS = [
    {
        model: Presentacion,
        as: 'presentaciones',
        attributes: ['id', 'nombre', 'factor_conversion', 'precio_especial', 'codigo_barras', 'esta_activo', 'id_unidad_medida'],
        required: false,
        include: [{
            model: UnidadMedida,
            as: 'unidad_medida',
            attributes: ['id', 'nombre', 'abreviatura'],
        }]
    },
    {
        model: UnidadMedida,
        as: 'unidad_medida',
        attributes: ['id', 'nombre', 'abreviatura'],
    }
];

// ─── BÚSQUEDA TEXTO LIBRE ─────────────────────────────────────────────────────
export const buscarProductos = async ({ query, id_sucursal, solo_con_stock = true, limit = 20 }) => {
    const terminoLimpio = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const productos = await Producto.findAll({
        where: {
            esta_activo: true,
            [Op.or]: [
                where(
                    fn('f_unaccent', fn('lower', col('nombre_comercial'))),
                    { [Op.like]: `%${terminoLimpio}%` }
                ),
                where(
                    col('codigo_barras'),
                    { [Op.like]: `%${query}%` }
                ),
            ],
        },
        include: INCLUDES_POS,
        order: [['nombre_comercial', 'ASC']],
        limit: limit * 4,
    });

    const resultados = [];
    for (const p of productos) {
        const f = await formatearParaPOS(p, id_sucursal);
        if (solo_con_stock && !f.disponible) continue;
        resultados.push(f);
        if (resultados.length >= limit) break;
    }

    return resultados;
};

// ─── ESCANEO BARCODE ──────────────────────────────────────────────────────────
// Busca primero en Producto.codigo_barras, luego en Presentacion.codigo_barras
export const buscarPorBarcode = async ({ barcode, id_sucursal }) => {
    // 1. Barcode de unidad suelta
    const producto = await Producto.findOne({
        where: { codigo_barras: barcode, esta_activo: true },
        include: INCLUDES_POS,
    });

    if (producto) {
        const f = await formatearParaPOS(producto, id_sucursal);
        return { ...f, _tipo_scan: 'unidad', id_presentacion: null };
    }

    // 2. Barcode de caja/pack (Presentacion)
    const presentacion = await Presentacion.findOne({
        where: { codigo_barras: barcode, esta_activo: true },
        include: [
            {
                model: Producto,
                as: 'producto',
                where: { esta_activo: true },
                include: INCLUDES_POS,
            },
            {
                model: UnidadMedida,
                as: 'unidad_medida',
                attributes: ['id', 'nombre', 'abreviatura'],
            }
        ],
    });

    if (presentacion) {
        const f = await formatearParaPOS(presentacion.producto, id_sucursal);
        const factor = parseFloat(presentacion.factor_conversion);
        return {
            ...f,
            _tipo_scan: 'presentacion',
            id_presentacion: presentacion.id,
            precio_venta: parseFloat(presentacion.precio_especial),
            stock_disponible: Math.floor(f.stock_disponible / factor),
            disponible: Math.floor(f.stock_disponible / factor) > 0,
            id_unidad_medida: presentacion.id_unidad_medida || f.id_unidad_medida,
            unidad_medida_nombre: presentacion.unidad_medida?.nombre || f.unidad_medida_nombre,
            unidad_medida_abreviatura: presentacion.unidad_medida?.abreviatura || f.unidad_medida_abreviatura,
        };
    }

    // 3. Barcode es un Número de Serie (ProductoSerie)
    const serie = await ProductoSerie.findOne({
        where: { numero_serie: barcode, estado: 'DISPONIBLE' },
        include: [{
            model: Lote,
            as: 'lote',
            include: [{
                model: Producto,
                as: 'producto',
                where: { esta_activo: true },
                include: INCLUDES_POS
            }]
        }]
    });

    if (serie && serie.lote && serie.lote.producto) {
        const p = serie.lote.producto;
        const f = await formatearParaPOS(p, id_sucursal);
        return {
            ...f,
            _tipo_scan: 'serie',
            id_presentacion: null,
            numero_serie_scaneado: barcode
        };
    }

    const err = new Error(`Código o serie "${barcode}" no encontrado.`);
    err.statusCode = 404;
    throw err;
};

// ─── DETALLE POR ID ───────────────────────────────────────────────────────────
export const getProductoParaPOS = async ({ id_producto, id_sucursal }) => {
    const producto = await Producto.findOne({
        where: { id: id_producto, esta_activo: true },
        include: INCLUDES_POS,
    });
    if (!producto) {
        const err = new Error('Producto no encontrado.');
        err.statusCode = 404;
        throw err;
    }
    return formatearParaPOS(producto, id_sucursal);
};

// ─── VALIDAR CANTIDAD (botón +/- del carrito) ─────────────────────────────────
export const validarCantidad = async ({ id_producto, id_presentacion, cantidad, id_sucursal }) => {
    const producto = await Producto.findByPk(id_producto);
    if (!producto) {
        const err = new Error('Producto no encontrado.');
        err.statusCode = 404;
        throw err;
    }

    const { stockDisponible } = await getStock(producto, id_sucursal);

    let factor = 1;
    if (id_presentacion) {
        const pres = await Presentacion.findOne({
            where: { id: id_presentacion, id_producto, esta_activo: true },
        });
        if (!pres) {
            const err = new Error('Presentación no encontrada.');
            err.statusCode = 404;
            throw err;
        }
        factor = parseFloat(pres.factor_conversion);
    }

    const unidades_requeridas = parseFloat(cantidad) * factor;
    const cantidad_maxima = Math.floor(stockDisponible / factor);

    return {
        valido: unidades_requeridas <= stockDisponible,
        stock_base_disponible: stockDisponible,
        cantidad_maxima,
        unidades_requeridas,
        factor,
    };
};