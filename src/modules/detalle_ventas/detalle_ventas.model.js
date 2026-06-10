import { Model, DataTypes } from 'sequelize';

class DetalleVenta extends Model {
    static associate(models) {
        this.belongsTo(models.Venta, { foreignKey: 'id_venta', as: 'venta' });
        this.belongsTo(models.Producto, { foreignKey: 'id_producto', as: 'producto' });
        this.belongsTo(models.Presentacion, { foreignKey: 'id_presentacion', as: 'presentacion' });
        this.hasMany(models.DetalleDevolucion, { foreignKey: 'id_detalle_venta', as: 'devoluciones' });
    }
}

export default (sequelize) => {
    DetalleVenta.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_venta: {
            type: DataTypes.UUID,
            allowNull: false
        },
        id_producto: {
            type: DataTypes.UUID,
            allowNull: false
        },
        id_presentacion: {
            type: DataTypes.UUID,
            allowNull: true
        },
        numero_serie: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        cantidad: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        factor_aplicado: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        precio_unitario: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        monto_descuento: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'DetalleVenta',
        tableName: 'Detalle_Ventas',
        timestamps: false,
    });
    return DetalleVenta;
};