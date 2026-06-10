import { Model, DataTypes } from 'sequelize';

class DetalleCompra extends Model {
    static associate(models) {
        this.belongsTo(models.Compra, { foreignKey: 'id_compra', as: 'compra' });
        this.belongsTo(models.Producto, { foreignKey: 'id_producto', as: 'producto' });
        this.belongsTo(models.Lote, { foreignKey: 'id_lote', as: 'lote' }); // Lote generado
    }
}

export default (sequelize) => {
    DetalleCompra.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_compra: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_producto: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_lote: {
            type: DataTypes.UUID,
            allowNull: true, // Se vincula luego de crearlo en el servicio
        },
        cantidad: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        costo_unitario: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        fecha_vencimiento_lote: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        }
    }, {
        sequelize,
        modelName: 'DetalleCompra',
        tableName: 'DetalleCompras',
        timestamps: true,
    });
    return DetalleCompra;
};

