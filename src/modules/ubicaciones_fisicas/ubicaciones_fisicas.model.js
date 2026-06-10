import { Model, DataTypes } from 'sequelize';

class UbicacionFisica extends Model {
    static associate(models) {
        this.belongsTo(models.Ubicacion, { foreignKey: 'id_ubicacion', as: 'ubicacion' });
        this.hasMany(models.StockDistribucion, { foreignKey: 'id_ubicacion_fisica', as: 'stock_distribuciones' });
        this.hasMany(models.KardexMovimiento, { foreignKey: 'id_ubicacion_fisica_origen', as: 'movimientos_origen' });
        this.hasMany(models.KardexMovimiento, { foreignKey: 'id_ubicacion_fisica_destino', as: 'movimientos_destino' });
    }
}

export default (sequelize) => {
    UbicacionFisica.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_ubicacion: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        nombre: {
            type: DataTypes.STRING(150),
            allowNull: false,
        },
        descripcion: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'UbicacionFisica',
        tableName: 'UbicacionesFisicas',
        timestamps: true,
    });
    return UbicacionFisica;
};
