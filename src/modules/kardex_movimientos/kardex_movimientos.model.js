import { Model, DataTypes } from 'sequelize';

class KardexMovimiento extends Model {
    static associate(models) {
        this.belongsTo(models.Lote, { foreignKey: 'id_lote', as: 'lote' });
        this.belongsTo(models.Ubicacion, { foreignKey: 'id_ubicacion_origen', as: 'ubicacion_origen' });
        this.belongsTo(models.Ubicacion, { foreignKey: 'id_ubicacion_destino', as: 'ubicacion_destino' });
        this.belongsTo(models.UbicacionFisica, { foreignKey: 'id_ubicacion_fisica_origen', as: 'ubicacion_fisica_origen' });
        this.belongsTo(models.UbicacionFisica, { foreignKey: 'id_ubicacion_fisica_destino', as: 'ubicacion_fisica_destino' });
        this.belongsTo(models.Usuario, { foreignKey: 'id_usuario', as: 'usuario' });
    }
}

export default (sequelize) => {
    KardexMovimiento.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_lote: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        tipo_movimiento: {
            type: DataTypes.ENUM('INGRESO', 'VENTA', 'TRASLADO', 'AJUSTE', 'DEVOLUCION', 'ANULACION'),
            allowNull: false,
        },
        cantidad: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        id_ubicacion_origen: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        id_ubicacion_destino: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        id_ubicacion_fisica_origen: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        id_ubicacion_fisica_destino: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        id_usuario: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        fecha: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false,
        },
        observacion: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'KardexMovimiento',
        tableName: 'KardexMovimientos',
        timestamps: true,
    });
    return KardexMovimiento;
};
