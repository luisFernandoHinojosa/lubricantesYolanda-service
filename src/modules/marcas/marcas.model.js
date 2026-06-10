import { Model, DataTypes } from 'sequelize';

class Marca extends Model {
    static associate(models) {
    }
}

export default (sequelize) => {
    Marca.init({
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
        modelName: 'Marca',
        tableName: 'Marcas',
        timestamps: true,
    });
    return Marca;
};
