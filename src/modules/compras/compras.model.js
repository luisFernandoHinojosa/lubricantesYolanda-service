import { Model, DataTypes } from 'sequelize';

class Compra extends Model {
    static associate(models) {
        this.belongsTo(models.Proveedor, { foreignKey: 'id_proveedor', as: 'proveedor' });
        this.belongsTo(models.Empleado, { foreignKey: 'id_empleado', as: 'empleado' });
        this.belongsTo(models.Sucursal, { foreignKey: 'id_sucursal', as: 'sucursal' });
        this.hasMany(models.DetalleCompra, { foreignKey: 'id_compra', as: 'detalles' });
    }
}

export default (sequelize) => {
    Compra.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_proveedor: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_empleado: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_sucursal: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        numero_comprobante: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        total: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        },
        estado_pago: {
            type: DataTypes.ENUM('PENDIENTE', 'PAGADO_PARCIAL', 'PAGADO'),
            defaultValue: 'PAGADO',
            allowNull: false,
        },
        fecha_compra: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false,
        },
        notas: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'Compra',
        tableName: 'Compras',
        timestamps: true,
    });
    return Compra;
};
