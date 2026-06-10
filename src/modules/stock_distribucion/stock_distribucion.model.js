import { Model, DataTypes } from 'sequelize';

class StockDistribucion extends Model {
    static associate(models) {
        this.belongsTo(models.Lote, { foreignKey: 'id_lote', as: 'lote' });
        this.belongsTo(models.Ubicacion, { foreignKey: 'id_ubicacion', as: 'ubicacion' });
        this.belongsTo(models.UbicacionFisica, { foreignKey: 'id_ubicacion_fisica', as: 'ubicacion_fisica' });
    }
}

export default (sequelize) => {
    StockDistribucion.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        id_lote: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_ubicacion: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        cantidad_actual: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
            allowNull: false,
        },
        id_ubicacion_fisica: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'StockDistribucion',
        tableName: 'StockDistribucion',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['id_lote', 'id_ubicacion', 'id_ubicacion_fisica'],
                name: 'unique_stock_lote_ubicacion',
            },
        ],
    });
    return StockDistribucion;
};
