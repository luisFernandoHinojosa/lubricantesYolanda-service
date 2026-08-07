import { Model, DataTypes } from 'sequelize';

class DetalleProforma extends Model {
    static associate(models) {
        this.belongsTo(models.Proforma, { foreignKey: 'id_proforma', as: 'proforma' });
        this.belongsTo(models.Producto, { foreignKey: 'id_producto', as: 'producto' });
        this.belongsTo(models.Presentacion, { foreignKey: 'id_presentacion', as: 'presentacion' });
    }
}

export default (sequelize) => {
    DetalleProforma.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_proforma: {
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
        modelName: 'DetalleProforma',
        tableName: 'Detalle_Proformas',
        timestamps: false,
    });
    return DetalleProforma;
};
