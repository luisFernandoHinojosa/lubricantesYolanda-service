import { Model, DataTypes } from 'sequelize';

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
            allowNull: false,
            unique: true, // Relación 1 a 1
        },
        estado: {
            type: DataTypes.ENUM('PENDIENTE', 'FACTURADA', 'ERROR'),
            defaultValue: 'PENDIENTE',
            allowNull: false,
        },
        numero_factura: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        cuf: {
            type: DataTypes.STRING(200),
            allowNull: true,
            comment: 'Código Único de Facturación devuelto por el proveedor',
        },
        url_factura_pdf: {
            type: DataTypes.TEXT,
            allowNull: true,
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
    });

    return Factura;
};
