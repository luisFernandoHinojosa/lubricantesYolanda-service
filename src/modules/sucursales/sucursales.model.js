import { Model, DataTypes } from 'sequelize';

class Sucursal extends Model {
    static associate(models) {
        this.hasMany(models.Ubicacion, { foreignKey: 'id_sucursal', as: 'ubicaciones' });
        this.hasMany(models.Movimiento, { foreignKey: 'sucursalId', as: 'movimientos' });
    }
}

export default (sequelize) => {
    Sucursal.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        nombre: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        direccion: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        telefono: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        ciudad: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        responsable: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'Sucursal',
        tableName: 'Sucursales',
        timestamps: true,
    });
    return Sucursal;
};
