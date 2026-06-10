import { Model, DataTypes } from 'sequelize';

class Movimiento extends Model {
    static associate(models) {
        this.belongsTo(models.CategoriaMovimiento, { foreignKey: 'categoriaMovimientoId', as: 'categoria_movimiento' });
        this.belongsTo(models.Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });
        this.belongsTo(models.Empleado, { foreignKey: 'empleadoId', as: 'empleado' });
    }
}

export default (sequelize) => {
    Movimiento.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        nombre: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        monto: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
        },
        descripcion: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        fecha: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        tipo: {
            type: DataTypes.ENUM('INGRESO', 'EGRESO'),
            allowNull: false,
        },
        tipoPago: {
            type: DataTypes.ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR', 'CHEQUE', 'OTRO'),
            allowNull: false,
        },
        divisa: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: 'BOB',
        },
        categoriaMovimientoId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'CategoriasMovimientos',
                key: 'id',
            },
        },
        sucursalId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Sucursales',
                key: 'id',
            },
        },
        empleadoId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'Empleados',
                key: 'id',
            },
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'Movimiento',
        tableName: 'Movimientos',
        timestamps: true,
    });
    return Movimiento;
};
