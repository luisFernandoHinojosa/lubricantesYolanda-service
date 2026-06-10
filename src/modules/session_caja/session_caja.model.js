import { Model, DataTypes } from 'sequelize';

class SesionCaja extends Model {
    static associate(models) {
        this.belongsTo(models.Sucursal, { foreignKey: 'id_sucursal', as: 'sucursal' });
        this.belongsTo(models.Empleado, { foreignKey: 'id_empleado', as: 'empleado' });
        this.hasMany(models.Venta, { foreignKey: 'id_sesion_caja', as: 'ventas' });
    }
}

export default (sequelize) => {
    SesionCaja.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_sucursal: {
            type: DataTypes.UUID,
            allowNull: false
        },
        id_empleado: {
            type: DataTypes.UUID,
            allowNull: false
        },
        monto_apertura: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        monto_cierre: {
            type: DataTypes.DECIMAL(10, 2)
        },
        monto_teorico: {
            type: DataTypes.DECIMAL(10, 2)
        },
        estado: {
            type: DataTypes.ENUM('ABIERTA', 'CERRADA'),
            defaultValue: 'ABIERTA'
        },
        fecha_apertura: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        fecha_cierre: {
            type: DataTypes.DATE
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        sequelize,
        modelName: 'SesionCaja',
        tableName: 'Sesiones_Caja',
        timestamps: false,
    });
    return SesionCaja;
};