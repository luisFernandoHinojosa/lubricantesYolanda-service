import { Model, DataTypes } from 'sequelize';

class Lote extends Model {
    static associate(models) {
        this.belongsTo(models.Producto, { foreignKey: 'id_producto', as: 'producto' });
        this.belongsTo(models.Proveedor, { foreignKey: 'id_proveedor', as: 'proveedor' });
        this.hasMany(models.StockDistribucion, { foreignKey: 'id_lote', as: 'stock_distribuciones' });
        this.hasMany(models.ProductoSerie, { foreignKey: 'id_lote', as: 'series' });
        this.hasMany(models.KardexMovimiento, { foreignKey: 'id_lote', as: 'movimientos' })
    }
}

export default (sequelize) => {
    Lote.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_producto: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_proveedor: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        codigo_lote: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        costo_compra_unitario: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0,
        },
        precio_venta_lote: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0,
        },
        fecha_vencimiento: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        fecha_ingreso: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'Lote',
        tableName: 'Lotes',
        timestamps: true,
    });
    return Lote;
};
