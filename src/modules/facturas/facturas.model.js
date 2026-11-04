import { Model, DataTypes, Op } from 'sequelize';

export default (sequelize) => {
    class Factura extends Model {
        static associate(models) {
            this.belongsTo(models.Venta, { foreignKey: 'id_venta', as: 'venta' });
        }
    }

    Factura.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_venta: {
            type: DataTypes.UUID,
            // Una venta puede tener varias facturas (las anuladas quedan como historial),
            // pero una sola vigente: ver el índice parcial más abajo
            allowNull: false,
        },
        estado: {
            type: DataTypes.ENUM('PENDIENTE', 'FACTURADA', 'ERROR', 'ANULADA'),
            defaultValue: 'PENDIENTE',
            allowNull: false,
        },
        // Correlativo asignado por la secuencia "Facturas_numero_factura_seq"
        // (ver src/scripts/migrate_numero_factura.js). Se reutiliza al reintentar.
        numero_factura: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
        },
        cuf: {
            type: DataTypes.STRING(200),
            allowNull: true,
            comment: 'Código Único de Facturación devuelto por el proveedor',
        },
        url_factura_pdf: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'PDF de la factura generado por el proveedor (urlFactura)',
        },
        url_siat: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Enlace de verificación del SIAT, el mismo del QR (urlSiat)',
        },
        estado_siat: {
            type: DataTypes.STRING(30),
            allowNull: true,
            comment: 'Respuesta del SIAT (siatRespuesta): VALIDA, OBSERVADA, etc.',
        },
        cufd: {
            type: DataTypes.STRING(200),
            allowNull: true,
            comment: 'Código Único de Facturación Diario con el que se emitió',
        },
        codigo_control: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        codigo_ambiente: {
            type: DataTypes.SMALLINT,
            allowNull: true,
            comment: '1 = producción, 2 = pruebas (piloto)',
        },
        fecha_emision: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Instante en que el SIAT validó la factura',
        },
        fecha_anulacion: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Instante en que el proveedor aceptó la anulación (ver migrate_factura_anulacion.js)',
        },
        xml_factura: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'XML firmado devuelto por el SIAT/Proveedor',
        },
        monto_iva: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            comment: 'Monto del IVA calculado (porcentaje configurable)',
        },
        errores_facturacion: {
            type: DataTypes.TEXT,
            allowNull: true,
        }
    }, {
        sequelize,
        modelName: 'Factura',
        tableName: 'Facturas',
        timestamps: true,
        updatedAt: true,
        // Creado por src/scripts/migrate_facturas_por_venta.js en las tablas existentes
        indexes: [
            {
                name: 'Facturas_id_venta_vigente_uk',
                unique: true,
                fields: ['id_venta'],
                where: { estado: { [Op.ne]: 'ANULADA' } },
            },
        ],
    });

    return Factura;
};
