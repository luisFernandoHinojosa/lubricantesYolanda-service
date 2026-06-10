import { Model, DataTypes } from 'sequelize';

class DetalleDevolucion extends Model {
    static associate(models) {
        this.belongsTo(models.Devolucion, { foreignKey: 'id_devolucion', as: 'devolucion' });
        this.belongsTo(models.DetalleVenta, { foreignKey: 'id_detalle_venta', as: 'detalle_venta_original' });
        this.belongsTo(models.Producto, { foreignKey: 'id_producto_original', as: 'producto_original' });
        this.belongsTo(models.Producto, { foreignKey: 'id_producto_nuevo', as: 'producto_nuevo' });
        this.belongsTo(models.Presentacion, { foreignKey: 'id_presentacion_original', as: 'presentacion_original' });
        this.belongsTo(models.Presentacion, { foreignKey: 'id_presentacion_nueva', as: 'presentacion_nueva' });
    }
}

export default (sequelize) => {
    DetalleDevolucion.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_devolucion: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_detalle_venta: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        // ── Producto devuelto ─────────────────────────────────────────────────
        id_producto_original: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_presentacion_original: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        cantidad_devuelta: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        factor_original: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 1,
        },
        precio_original: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        subtotal_devuelto: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        numero_serie_devuelta: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        // ── Producto nuevo (solo CAMBIO) ──────────────────────────────────────
        id_producto_nuevo: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        id_presentacion_nueva: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        cantidad_nueva: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        factor_nuevo: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        precio_nuevo: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        subtotal_nuevo: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
        },
        numero_serie_nueva: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
    }, {
        sequelize,
        modelName: 'DetalleDevolucion',
        tableName: 'Detalle_Devoluciones',
        timestamps: false,
    });
    return DetalleDevolucion;
};
