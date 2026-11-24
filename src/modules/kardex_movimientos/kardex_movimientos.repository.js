import { QueryTypes } from 'sequelize';
import db from '../../database/index.js';

/*
 * El kardex se consulta con SQL crudo porque necesita columnas calculadas
 * (entrada/salida/naturaleza según el alcance), búsqueda por palabras con unaccent
 * y saldos acumulados con window functions.
 *
 * Regla de signo (la cantidad siempre se guarda positiva):
 *   INGRESO, DEVOLUCION, ANULACION → entrada
 *   VENTA                          → salida
 *   AJUSTE                         → entrada si tiene destino, salida si tiene origen
 *   TRASLADO                       → depende del alcance consultado: sale del origen y entra al destino.
 *                                    Sin filtro de sucursal/ubicación (o si ambos lados están dentro
 *                                    del alcance) es NEUTRO: no cambia el stock total.
 */

const SORT_COLUMNS = {
    fecha: 'fecha',
    cantidad: 'cantidad',
    producto: 'producto_nombre',
    tipo_movimiento: 'tipo_movimiento::text',
};

const FROM_JOINS = `
    FROM "KardexMovimientos" km
    JOIN "Lotes" l ON l.id = km.id_lote
    JOIN "Productos" p ON p.id = l.id_producto
    LEFT JOIN "Marcas" m ON m.id = p.id_marca
    LEFT JOIN "Categorias" c ON c.id = p.id_categoria
    LEFT JOIN "UnidadMedidas" um ON um.id = p.id_unidad_medida
    LEFT JOIN "Proveedores" pr ON pr.id = l.id_proveedor
    LEFT JOIN "Ubicaciones" uo ON uo.id = km.id_ubicacion_origen
    LEFT JOIN "Sucursales" so ON so.id = uo.id_sucursal
    LEFT JOIN "UbicacionesFisicas" ufo ON ufo.id = km.id_ubicacion_fisica_origen
    LEFT JOIN "Ubicaciones" ud ON ud.id = km.id_ubicacion_destino
    LEFT JOIN "Sucursales" sd ON sd.id = ud.id_sucursal
    LEFT JOIN "UbicacionesFisicas" ufd ON ufd.id = km.id_ubicacion_fisica_destino
    LEFT JOIN "Usuarios" us ON us.id = km.id_usuario
    LEFT JOIN LATERAL (
        SELECT NULLIF(TRIM(CONCAT_WS(' ', e.nombre, e.apellido_paterno, e.apellido_materno)), '') AS nombre_completo
        FROM "Empleados" e
        WHERE e.usuario_id = km.id_usuario
        LIMIT 1
    ) emp ON TRUE
`;

// Condiciones "el origen/destino está dentro del alcance consultado"
const construirAlcance = ({ id_ubicacion, id_sucursal }) => {
    if (id_ubicacion) {
        return {
            enOrigen: 'COALESCE(km.id_ubicacion_origen = :id_ubicacion, FALSE)',
            enDestino: 'COALESCE(km.id_ubicacion_destino = :id_ubicacion, FALSE)',
            where: '(km.id_ubicacion_origen = :id_ubicacion OR km.id_ubicacion_destino = :id_ubicacion)',
        };
    }
    if (id_sucursal) {
        return {
            enOrigen: 'COALESCE(uo.id_sucursal = :id_sucursal, FALSE)',
            enDestino: 'COALESCE(ud.id_sucursal = :id_sucursal, FALSE)',
            where: '(uo.id_sucursal = :id_sucursal OR ud.id_sucursal = :id_sucursal)',
        };
    }
    return { enOrigen: 'TRUE', enDestino: 'TRUE', where: null };
};

const columnasBase = ({ enOrigen, enDestino }) => `
    km.id,
    km.fecha,
    km."createdAt" AS creado_en,
    km.tipo_movimiento,
    CAST(km.cantidad AS float8) AS cantidad,
    km.observacion,
    km.id_lote,
    l.codigo_lote,
    to_char(l.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
    CAST(COALESCE(l.costo_compra_unitario, 0) AS float8) AS costo_unitario,
    p.id AS id_producto,
    p.nombre_comercial AS producto_nombre,
    p.sku AS producto_sku,
    p.codigo_producto,
    p.codigo_barras,
    m.nombre AS marca,
    c.nombre AS categoria,
    um.nombre AS unidad_nombre,
    um.abreviatura AS unidad_abreviatura,
    pr.id AS id_proveedor,
    COALESCE(NULLIF(pr.razon_social, ''), NULLIF(pr.empresa, ''), pr.nombre) AS proveedor,
    uo.id AS origen_id, uo.nombre AS origen_nombre, uo.tipo_area AS origen_tipo_area,
    so.id AS origen_sucursal_id, so.nombre AS origen_sucursal,
    ufo.id AS origen_fisica_id, ufo.nombre AS origen_fisica,
    ud.id AS destino_id, ud.nombre AS destino_nombre, ud.tipo_area AS destino_tipo_area,
    sd.id AS destino_sucursal_id, sd.nombre AS destino_sucursal,
    ufd.id AS destino_fisica_id, ufd.nombre AS destino_fisica,
    km.id_usuario,
    emp.nombre_completo AS usuario_nombre,
    us.name_user AS usuario_username,
    CAST(CASE
        WHEN km.tipo_movimiento IN ('INGRESO', 'DEVOLUCION', 'ANULACION') THEN km.cantidad
        WHEN km.tipo_movimiento = 'AJUSTE' AND km.id_ubicacion_destino IS NOT NULL THEN km.cantidad
        WHEN km.tipo_movimiento = 'TRASLADO' AND ${enDestino} AND NOT ${enOrigen} THEN km.cantidad
        ELSE 0
    END AS float8) AS entrada,
    CAST(CASE
        WHEN km.tipo_movimiento = 'VENTA' THEN km.cantidad
        WHEN km.tipo_movimiento = 'AJUSTE' AND km.id_ubicacion_destino IS NULL THEN km.cantidad
        WHEN km.tipo_movimiento = 'TRASLADO' AND ${enOrigen} AND NOT ${enDestino} THEN km.cantidad
        ELSE 0
    END AS float8) AS salida
`;

// CTE "mov": movimientos con naturaleza, neto y valor ya calculados
const construirCteMov = (filtros, condicionesExtra = []) => {
    const alcance = construirAlcance(filtros);
    const condiciones = ['km.esta_activo IS NOT FALSE', ...condicionesExtra];
    if (alcance.where) condiciones.push(alcance.where);

    return `
        WITH base AS (
            SELECT ${columnasBase(alcance)}
            ${FROM_JOINS}
            WHERE ${condiciones.join(' AND ')}
        ),
        mov AS (
            SELECT base.*,
                entrada - salida AS neto,
                CASE WHEN entrada > 0 THEN 'ENTRADA' WHEN salida > 0 THEN 'SALIDA' ELSE 'NEUTRO' END AS naturaleza,
                ROUND(CAST(cantidad * costo_unitario AS numeric), 2)::float8 AS valor_total
            FROM base
        )
    `;
};

const escaparLike = (texto) => texto.replace(/[\\%_]/g, (c) => `\\${c}`);

const normalizarTexto = (texto) =>
    texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Cada palabra debe aparecer en alguno de los campos (AND entre palabras, OR entre campos)
const construirBusqueda = (search, replacements) => {
    const palabras = normalizarTexto(search).split(/\s+/).filter(Boolean).slice(0, 8);
    return palabras.map((palabra, i) => {
        const key = `w${i}`;
        replacements[key] = `%${escaparLike(palabra)}%`;
        return `(
            f_unaccent(lower(p.nombre_comercial)) LIKE :${key}
            OR f_unaccent(lower(COALESCE(m.nombre, ''))) LIKE :${key}
            OR lower(COALESCE(p.sku, '')) LIKE :${key}
            OR lower(COALESCE(p.codigo_producto, '')) LIKE :${key}
            OR lower(COALESCE(p.codigo_barras, '')) LIKE :${key}
            OR lower(l.codigo_lote) LIKE :${key}
            OR f_unaccent(lower(COALESCE(km.observacion, ''))) LIKE :${key}
        )`;
    });
};

const query = (sql, replacements) =>
    db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

// ─── LISTADO GENERAL ─────────────────────────────────────────────────────────
export const listar = async (filtros, { limit, offset, sortBy = 'fecha', sortOrder = 'DESC' }) => {
    const replacements = { ...filtros, limit, offset };
    const condiciones = [];

    if (filtros.id_producto) condiciones.push('l.id_producto = :id_producto');
    if (filtros.id_lote) condiciones.push('km.id_lote = :id_lote');
    if (filtros.id_usuario) condiciones.push('km.id_usuario = :id_usuario');
    if (filtros.tipo_movimiento?.length) condiciones.push('km.tipo_movimiento IN (:tipo_movimiento)');
    if (filtros.inicio) condiciones.push('km.fecha >= :inicio');
    if (filtros.fin) condiciones.push('km.fecha <= :fin');
    if (filtros.search) condiciones.push(...construirBusqueda(filtros.search, replacements));

    const cte = `${construirCteMov(filtros, condiciones)},
        filtrada AS (
            SELECT * FROM mov
            ${filtros.naturaleza ? 'WHERE naturaleza = :naturaleza' : ''}
        )`;

    const columna = SORT_COLUMNS[sortBy] ?? 'fecha';
    const dir = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const [rows, [resumen]] = await Promise.all([
        query(`${cte}
            SELECT * FROM filtrada
            ORDER BY ${columna} ${dir}, creado_en ${dir}, id ${dir}
            LIMIT :limit OFFSET :offset`, replacements),
        query(`${cte}
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE naturaleza = 'ENTRADA')::int AS entradas,
                COUNT(*) FILTER (WHERE naturaleza = 'SALIDA')::int AS salidas,
                COUNT(*) FILTER (WHERE naturaleza = 'NEUTRO')::int AS neutros,
                COALESCE(SUM(valor_total) FILTER (WHERE naturaleza = 'ENTRADA'), 0)::float8 AS valor_entradas,
                COALESCE(SUM(valor_total) FILTER (WHERE naturaleza = 'SALIDA'), 0)::float8 AS valor_salidas
            FROM filtrada`, replacements),
    ]);

    return { rows, resumen };
};

export const buscarPorId = async (id) => {
    const rows = await query(`${construirCteMov({}, ['km.id = :id'])} SELECT * FROM mov`, { id });
    return rows[0] ?? null;
};

// ─── TARJETA KARDEX (por producto, con saldos) ───────────────────────────────
export const tarjeta = async (filtros, { limit, offset, sortOrder = 'ASC' }) => {
    const replacements = { ...filtros, limit, offset };
    const condiciones = ['l.id_producto = :id_producto'];
    if (filtros.id_lote) condiciones.push('km.id_lote = :id_lote');

    // El saldo se acumula sobre TODO el historial hasta "fin"; luego se recorta el periodo
    const condicionesSaldo = filtros.fin ? [...condiciones, 'km.fecha <= :fin'] : condiciones;

    const filtrosSalida = [];
    if (filtros.inicio) filtrosSalida.push('fecha >= :inicio');
    if (filtros.tipo_movimiento?.length) filtrosSalida.push('tipo_movimiento IN (:tipo_movimiento)');
    if (filtros.naturaleza) filtrosSalida.push('naturaleza = :naturaleza');
    const whereSalida = filtrosSalida.length ? `WHERE ${filtrosSalida.join(' AND ')}` : '';

    const cteSaldos = `${construirCteMov(filtros, condicionesSaldo)},
        saldos AS (
            SELECT mov.*,
                SUM(neto) OVER w AS saldo,
                ROUND(CAST(SUM(neto * costo_unitario) OVER w AS numeric), 2)::float8 AS saldo_valorizado
            FROM mov
            WINDOW w AS (ORDER BY fecha, creado_en, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
        )`;

    const dir = sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const enRango = [
        filtros.inicio ? 'fecha >= :inicio' : null,
        filtros.fin ? 'fecha <= :fin' : null,
    ].filter(Boolean).join(' AND ') || 'TRUE';

    const [rows, [{ total }], [resumen]] = await Promise.all([
        query(`${cteSaldos}
            SELECT * FROM saldos ${whereSalida}
            ORDER BY fecha ${dir}, creado_en ${dir}, id ${dir}
            LIMIT :limit OFFSET :offset`, replacements),
        query(`${cteSaldos} SELECT COUNT(*)::int AS total FROM saldos ${whereSalida}`, replacements),
        // Resumen del periodo: ignora los filtros de tipo/naturaleza, siempre muestra el panorama completo
        query(`${construirCteMov(filtros, condiciones)}
            SELECT
                ${filtros.inicio ? 'COALESCE(SUM(neto) FILTER (WHERE fecha < :inicio), 0)' : '0'}::float8 AS saldo_inicial,
                ${filtros.inicio ? 'COALESCE(SUM(neto * costo_unitario) FILTER (WHERE fecha < :inicio), 0)' : '0'}::float8 AS valor_inicial,
                COALESCE(SUM(entrada) FILTER (WHERE ${enRango}), 0)::float8 AS total_entradas,
                COALESCE(SUM(salida) FILTER (WHERE ${enRango}), 0)::float8 AS total_salidas,
                COALESCE(SUM(entrada * costo_unitario) FILTER (WHERE ${enRango}), 0)::float8 AS valor_entradas,
                COALESCE(SUM(salida * costo_unitario) FILTER (WHERE ${enRango}), 0)::float8 AS valor_salidas,
                COUNT(*) FILTER (WHERE ${enRango})::int AS movimientos,
                COALESCE(SUM(neto), 0)::float8 AS saldo_historico
            FROM mov`, replacements),
    ]);

    return { rows, total, resumen };
};

// Stock real según StockDistribucion, en el mismo alcance que el kardex
export const stockSistema = async ({ id_producto, id_lote, id_ubicacion, id_sucursal }) => {
    const condiciones = ['l.id_producto = :id_producto'];
    if (id_lote) condiciones.push('sd.id_lote = :id_lote');
    if (id_ubicacion) condiciones.push('sd.id_ubicacion = :id_ubicacion');
    else if (id_sucursal) condiciones.push('u.id_sucursal = :id_sucursal');

    const [{ stock }] = await query(`
        SELECT COALESCE(SUM(sd.cantidad_actual), 0)::float8 AS stock
        FROM "StockDistribucion" sd
        JOIN "Lotes" l ON l.id = sd.id_lote
        LEFT JOIN "Ubicaciones" u ON u.id = sd.id_ubicacion
        WHERE ${condiciones.join(' AND ')}
    `, { id_producto, id_lote, id_ubicacion, id_sucursal });

    return stock;
};

export const buscarProducto = (id_producto) =>
    db.Producto.findByPk(id_producto, {
        attributes: ['id', 'nombre_comercial', 'sku', 'codigo_producto', 'codigo_barras', 'stock_minimo', 'imagen_url', 'maneja_vencimiento'],
        include: [
            { model: db.Marca, as: 'marca', attributes: ['id', 'nombre'] },
            { model: db.Categoria, as: 'categoria', attributes: ['id', 'nombre'] },
            { model: db.UnidadMedida, as: 'unidad_medida', attributes: ['id', 'nombre', 'abreviatura'] },
        ],
    });

export const lotesDeProducto = (id_producto) =>
    db.Lote.findAll({
        where: { id_producto },
        attributes: ['id', 'codigo_lote', 'fecha_vencimiento', 'esta_activo'],
        order: [['fecha_ingreso', 'DESC']],
    });
