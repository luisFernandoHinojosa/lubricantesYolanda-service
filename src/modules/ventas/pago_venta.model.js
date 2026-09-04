import { Model, DataTypes } from 'sequelize';

class PagoVenta extends Model {
    static associate(models) {
        this.belongsTo(models.Venta, { foreignKey: 'id_venta', as: 'venta' });
    }
}

export default (sequelize) => {
    PagoVenta.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_venta: {
            type: DataTypes.UUID,
            allowNull: false
        },
        metodo_pago: {
            type: DataTypes.ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR'),
            allowNull: false
        },
        monto: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        referencia: {
            type: DataTypes.STRING(255),
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'PagoVenta',
        tableName: 'PagosVenta',
        timestamps: true,
        updatedAt: false,
    });
    return PagoVenta;
};
