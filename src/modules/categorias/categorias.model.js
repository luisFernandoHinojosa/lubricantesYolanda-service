import { Model, DataTypes } from 'sequelize';

class Categoria extends Model {
    static associate(models) {
        // Define associations here if needed
    }
}

export default (sequelize) => {
    Categoria.init({
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
        siat_codigo_actividad: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        siat_codigo_producto: {
            type: DataTypes.INTEGER,
            allowNull: true,
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
        modelName: 'Categoria',
        tableName: 'Categorias',
        timestamps: true,
    });
    return Categoria;
};
