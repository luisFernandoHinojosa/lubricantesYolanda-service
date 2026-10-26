import { Model, DataTypes } from 'sequelize';
import { METODOS_PAGO_VALIDOS } from '../../constants/business.constants.js';

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
            type: DataTypes.ENUM(...METODOS_PAGO_VALIDOS),
            allowNull: false
        },
        // Posición del pago en el listado enviado; el primero (0) se usa para la factura
        orden: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
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
