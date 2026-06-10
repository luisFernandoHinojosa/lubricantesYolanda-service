import { Model, DataTypes } from 'sequelize';

class Devolucion extends Model {
    static associate(models) {
        this.belongsTo(models.Venta, { foreignKey: 'id_venta_original', as: 'venta_original' });
        this.belongsTo(models.Sucursal, { foreignKey: 'id_sucursal', as: 'sucursal' });
        this.belongsTo(models.SesionCaja, { foreignKey: 'id_sesion_caja', as: 'sesion' });
        this.belongsTo(models.Empleado, { foreignKey: 'id_empleado', as: 'empleado' });
        this.belongsTo(models.Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
        this.hasMany(models.DetalleDevolucion, { foreignKey: 'id_devolucion', as: 'detalles' });
    }
}

export default (sequelize) => {
    Devolucion.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        numero_devolucion: {
            type: DataTypes.STRING(50),
            unique: true,
            allowNull: false,
        },
        id_venta_original: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_sucursal: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_sesion_caja: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_empleado: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_cliente: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        tipo: {
            type: DataTypes.ENUM('DEVOLUCION', 'CAMBIO'),
            allowNull: false,
        },
        motivo: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        metodo_reembolso: {
            type: DataTypes.ENUM('EFECTIVO', 'CREDITO'),
            allowNull: false,
            defaultValue: 'EFECTIVO',
        },
        monto_devuelto: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        },
        monto_diferencia: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0,
        },
        estado: {
            type: DataTypes.ENUM('COMPLETADA', 'ANULADA'),
            allowNull: false,
            defaultValue: 'COMPLETADA',
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'Devolucion',
        tableName: 'Devoluciones',
        timestamps: true,
        updatedAt: false,
    });

    return Devolucion;
};
