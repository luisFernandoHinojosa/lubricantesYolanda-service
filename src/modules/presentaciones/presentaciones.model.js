import { Model, DataTypes } from 'sequelize';

class Presentacion extends Model {
    static associate(models) {
        this.belongsTo(models.Producto, { foreignKey: 'id_producto', as: 'producto' });
        this.belongsTo(models.UnidadMedida, { foreignKey: 'id_unidad_medida', as: 'unidad_medida' });
    }
}

export default (sequelize) => {
    Presentacion.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        codigo_barras: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true,
        },
        sku: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true,
        },
        id_producto: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        id_unidad_medida: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        nombre: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        factor_conversion: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
        },
        precio_especial: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'Presentacion',
        tableName: 'Presentaciones',
        timestamps: true,
    });
    return Presentacion;
};
