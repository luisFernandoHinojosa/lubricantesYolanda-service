import { Model, DataTypes } from 'sequelize';

class UnidadMedida extends Model {
    static associate(models) {
        this.hasMany(models.Producto, { foreignKey: 'id_unidad_medida', as: 'productos' });
    }
}

export default (sequelize) => {
    UnidadMedida.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        nombre: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        abreviatura: {
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'UnidadMedida',
        tableName: 'UnidadMedidas',
        timestamps: true,
    });
    return UnidadMedida;
};
