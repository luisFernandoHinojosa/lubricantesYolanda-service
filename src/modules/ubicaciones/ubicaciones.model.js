import { Model, DataTypes } from 'sequelize';

class Ubicacion extends Model {
    static associate(models) {
        this.belongsTo(models.Sucursal, { foreignKey: 'id_sucursal', as: 'sucursal' });
        this.hasMany(models.UbicacionFisica, { foreignKey: 'id_ubicacion', as: 'ubicaciones_fisicas' });
        this.hasMany(models.StockDistribucion, { foreignKey: 'id_ubicacion', as: 'stock' });
        this.hasMany(models.ProductoSerie, { foreignKey: 'id_ubicacion', as: 'series' });
    }
}

export default (sequelize) => {
    Ubicacion.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_sucursal: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        nombre: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        descripcion: {
            type: DataTypes.TEXT,
            allowNull: true,
            defaultValue: null,
        },
        tipo_area: {
            type: DataTypes.ENUM('VENTA', 'DEPOSITO', 'MERMA'),
            allowNull: false,
            defaultValue: 'DEPOSITO'
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'Ubicacion',
        tableName: 'Ubicaciones',
        timestamps: true,
    });
    return Ubicacion;
};
