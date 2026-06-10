import db from './database/index.js';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';

const randomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generarCodigoBarras = (length = 13) => {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
};

const generarSKUPro = ({ categoria, marca }) => {
    const cat = categoria.substring(0, 3).toUpperCase();
    const mar = marca.substring(0, 3).toUpperCase();
    const rand = Math.floor(Math.random() * 10000);
    return `${cat}-${mar}-${rand}`;
};

// =====================
// DATA REALISTA
// =====================
const nombres = ["Carlos", "Juan", "Luis", "Ana", "Maria", "Jose", "Fernando", "Diego", "Lucia", "Valeria", "Andres", "Sofia"];
const apellidos = ["Perez", "Gomez", "Rojas", "Fernandez", "Suarez", "Torrez", "Vargas", "Mendoza", "Castro", "Ortiz"];

const direcciones = [
    "Av. Banzer 3er anillo",
    "Av. Santos Dumont",
    "Plan 3000 zona central",
    "Villa 1ro de Mayo",
    "Centro calle Sucre",
    "Av. Paraguá",
    "Doble vía La Guardia"
];

const empresas = [
    "Ferretería El Constructor",
    "Importadora Industrial SRL",
    "Distribuidora Santa Cruz",
    "Materiales del Oriente",
    "Suministros Bolivia",
    "Ferretería El Tornillo",
    "Grupo Constructor Andino"
];

const productosBase = [
    { nombre: "Clavo 2 pulgadas", categoria: "Construcción" },
    { nombre: "Tornillo Philips", categoria: "Construcción" },
    { nombre: "Martillo Profesional", categoria: "Herramientas" },
    { nombre: "Taladro Percutor", categoria: "Herramientas" },
    { nombre: "Cable Eléctrico 10m", categoria: "Electricidad" },
    { nombre: "Cemento Portland 50kg", categoria: "Construcción" },
    { nombre: "Llave Inglesa", categoria: "Herramientas" },
    { nombre: "Interruptor Doble", categoria: "Electricidad" }
];

const presentacionesBase = [
    { nombre: "Caja x 10", factor: 10 },
    { nombre: "Caja x 50", factor: 50 },
    { nombre: "Paquete x 5", factor: 5 },
    { nombre: "Bolsa x 25", factor: 25 },
    { nombre: "Unidad", factor: 1 }
];

const seedDashboard = async () => {
    try {
        console.log('🚀 SEED PRO FERRETERÍA');

        await db.sequelize.sync({ force: false });

        const {
            Cliente, Categoria, Marca, UnidadMedida,
            Producto, Proveedor, Lote, Ubicacion,
            StockDistribucion, KardexMovimiento,
            Sucursal, Role, Empleado, Usuario
        } = db;

        // ========================
        // SUCURSALES
        // ========================
        const sucursales = [];
        for (let i = 0; i < 3; i++) {
            const [s] = await Sucursal.findOrCreate({
                where: { nombre: `Sucursal ${i + 1}` },
                defaults: {
                    direccion: randomFromArray(direcciones),
                    telefono: `7${Math.floor(1000000 + Math.random() * 9000000)}`
                }
            });
            sucursales.push(s);
        }

        // ========================
        // ROLES
        // ========================
        const roles = [];
        for (const r of ["Administrador", "Cajero", "Vendedor"]) {
            const [rol] = await Role.findOrCreate({
                where: { nombre_rol: r },
                defaults: {
                    code_rol: r.substring(0, 3).toUpperCase()
                }
            });
            roles.push(rol);
        }

        // ========================
        // USUARIOS
        // ========================
        const usuarios = [];
        for (let i = 0; i < 15; i++) {
            const nombre = randomFromArray(nombres);
            const apellido = randomFromArray(apellidos);

            const [u] = await Usuario.findOrCreate({
                where: { email: `${nombre}.${apellido}${i}@gmail.com`.toLowerCase() },
                defaults: {
                    name_user: `${nombre}${i}`,
                    password_hash: "123456",
                    rol_id: randomFromArray(roles).id,
                    id_sucursal: randomFromArray(sucursales).id
                }
            });
            usuarios.push(u);
        }

        // ========================
        // EMPLEADOS
        // ========================
        for (let i = 0; i < 50; i++) {
            const nombre = randomFromArray(nombres);
            const apellido = randomFromArray(apellidos);

            await Empleado.findOrCreate({
                where: { ci: `EMP-${2000 + i}` },
                defaults: {
                    nombre,
                    apellido_paterno: apellido,
                    apellido_materno: randomFromArray(apellidos),
                    usuario_id: randomFromArray(usuarios).id,
                    telefono: `7${Math.floor(1000000 + Math.random() * 9000000)}`,
                    direccion: randomFromArray(direcciones),
                    cargo: randomFromArray(["Vendedor", "Cajero", "Supervisor"]),
                    salario_base: Math.floor(Math.random() * 3000) + 2500,
                    fecha_contratacion: moment().subtract(Math.random() * 5, 'years').toDate(),
                    esta_activo: Math.random() > 0.1
                }
            });
        }

        // ========================
        // CLIENTES
        // ========================
        for (let i = 0; i < 100; i++) {
            const nombre = randomFromArray(nombres);
            const apellido = randomFromArray(apellidos);

            await Cliente.findOrCreate({
                where: { ci: `CLI-${3000 + i}` },
                defaults: {
                    nombre,
                    apellido_paterno: apellido,
                    fecha_nacimiento: moment().subtract(18 + Math.random() * 40, 'years').toDate(),
                    puntos: Math.floor(Math.random() * 2000)
                }
            });
        }

        // ========================
        // CATEGORIAS / MARCAS
        // ========================
        const categorias = [];
        for (const c of ["Herramientas", "Construcción", "Electricidad"]) {
            const [cat] = await Categoria.findOrCreate({ where: { nombre: c } });
            categorias.push(cat);
        }

        const marcas = [];
        for (const m of ["Truper", "Makita", "Bosch", "DeWalt", "Genérica"]) {
            const [marca] = await Marca.findOrCreate({ where: { nombre: m } });
            marcas.push(marca);
        }

        // ========================
        // UNIDADES
        // ========================
        const unidades = [];
        for (const u of [
            { abreviatura: "PZA", nombre: "Pieza" },
            { abreviatura: "KG", nombre: "Kilogramo" },
            { abreviatura: "MT", nombre: "Metro" }
        ]) {
            const [uni] = await UnidadMedida.findOrCreate({
                where: { abreviatura: u.abreviatura },
                defaults: { nombre: u.nombre }
            });
            unidades.push(uni);
        }

        // ========================
        // PROVEEDORES
        // ========================
        const proveedores = [];
        for (let i = 0; i < empresas.length; i++) {
            const [p] = await Proveedor.findOrCreate({
                where: { nit_ci: `NIT-${8000 + i}` },
                defaults: {
                    nombre: empresas[i],
                    apellido_paterno: randomFromArray(apellidos),
                    apellido_materno: randomFromArray(apellidos),
                    razon_social: empresas[i],
                    contacto: randomFromArray(nombres),
                    telefono: `7${Math.floor(1000000 + Math.random() * 9000000)}`,
                }
            });
            proveedores.push(p);
        }

        // ========================
        // UBICACIONES
        // ========================
        const ubicaciones = [];
        for (const nombre of ["Tienda", "Almacén", "Patio"]) {
            const [u] = await Ubicacion.findOrCreate({
                where: { nombre },
                defaults: { id_sucursal: sucursales[0].id }
            });
            ubicaciones.push(u);
        }

        // ========================
        // PRODUCTOS + STOCK
        // ========================
        for (let i = 0; i < 1000; i++) {
            const base = randomFromArray(productosBase);
            const marca = randomFromArray(marcas);
            const tipo = Math.floor(Math.random() * 4);

            const producto = await Producto.create({
                id: uuidv4(),
                sku: generarSKUPro({ categoria: base.categoria, marca: marca.nombre }),
                codigo_barras: generarCodigoBarras(),
                nombre_comercial: base.nombre,
                id_categoria: categorias.find(c => c.nombre === base.categoria).id,
                id_marca: marca.id,
                id_unidad_medida: randomFromArray(unidades).id,
                stock_minimo: Math.floor(Math.random() * 10) + 5,
                maneja_serie: tipo === 1,
                maneja_vencimiento: tipo === 2
            });

            // ========================
            // LOTE
            // ========================
            const costo = Math.random() * 50 + 5;
            const precio = costo * (1.3 + Math.random() * 0.5);

            const lote = await Lote.create({
                id: uuidv4(),
                codigo_lote: `LOT-${i}`,
                id_producto: producto.id,
                id_proveedor: randomFromArray(proveedores).id,
                costo_compra_unitario: costo,
                fecha_vencimiento: tipo === 2 ? moment().add(1, 'year').toDate() : null
            });

            const cantidad = Math.floor(Math.random() * 100) + 10;

            await StockDistribucion.create({
                id_lote: lote.id,
                id_ubicacion: randomFromArray(ubicaciones).id,
                cantidad_actual: cantidad
            });

            await KardexMovimiento.create({
                id_lote: lote.id,
                tipo_movimiento: 'INGRESO',
                cantidad,
                fecha: new Date(),
                id_ubicacion_destino: ubicaciones[1].id
            });

            // ========================
            // SERIES (si aplica)
            // ========================
            if (tipo === 1) {
                const series = [];
                for (let s = 0; s < cantidad; s++) {
                    series.push({
                        id_lote: lote.id,
                        id_ubicacion: randomFromArray(ubicaciones).id,
                        numero_serie: `SER-${i}-${s}`
                    });
                }
                await db.ProductoSerie.bulkCreate(series);
            }

            // ========================
            // PRESENTACIONES (🔥 AQUÍ ESTÁ LO NUEVO)
            // ========================
            if (tipo === 3) {
                const cantidadPresentaciones = Math.floor(Math.random() * 3) + 1;

                for (let p = 0; p < cantidadPresentaciones; p++) {
                    const pres = randomFromArray(presentacionesBase);

                    await db.Presentacion.create({
                        id_producto: producto.id,
                        sku: generarSKUPro({
                            categoria: base.nombre,
                            marca: marca.nombre
                        }),
                        codigo_barras: generarCodigoBarras(),
                        nombre: pres.nombre,
                        factor_conversion: pres.factor,
                        precio_especial: (precio * pres.factor) * (0.9 + Math.random() * 0.2), // descuento leve
                        id_unidad_medida: randomFromArray(unidades).id
                    });
                }
            }
        }

        console.log('✅ SEED COMPLETO Y REALISTA');
        process.exit(0);

    } catch (error) {
        console.error('❌ ERROR SEED:', error);
        process.exit(1);
    }
};

seedDashboard();