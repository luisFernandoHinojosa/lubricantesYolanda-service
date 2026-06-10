import { Model, DataTypes } from 'sequelize';

class ProductoSerie extends Model {
    static associate(models) {
        this.belongsTo(models.Lote, { foreignKey: 'id_lote', as: 'lote' });
        this.belongsTo(models.Ubicacion, { foreignKey: 'id_ubicacion', as: 'ubicacion' });
    }
}

export default (sequelize) => {
    ProductoSerie.init({
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
        numero_serie: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        estado: {
            type: DataTypes.ENUM('DISPONIBLE', 'VENDIDO', 'GARANTIA'),
            defaultValue: 'DISPONIBLE',
            allowNull: false
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'ProductoSerie',
        tableName: 'ProductosSeries',
        timestamps: true,
    });
    return ProductoSerie;
};
