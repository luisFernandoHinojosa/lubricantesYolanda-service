import { Model, DataTypes } from 'sequelize';

class Producto extends Model {
    static associate(models) {
        this.belongsTo(models.Categoria, { foreignKey: 'id_categoria', as: 'categoria' });
        this.belongsTo(models.Marca, { foreignKey: 'id_marca', as: 'marca' });
        this.belongsTo(models.UnidadMedida, { foreignKey: 'id_unidad_medida', as: 'unidad_medida' });
        this.hasMany(models.Presentacion, { foreignKey: 'id_producto', as: 'presentaciones' });
        this.hasMany(models.Lote, { foreignKey: 'id_producto', as: 'lotes' });
    }
}

export default (sequelize) => {
    Producto.init({
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
        codigo_producto: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true,
        },
        sku: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true,
        },
        precio_venta: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 0.00,
        },
        nombre_comercial: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        id_categoria: {
            type: DataTypes.UUID,
            allowNull: false
        },
        id_marca: {
            type: DataTypes.UUID,
            allowNull: false
        },
        id_unidad_medida: {
            type: DataTypes.UUID,
            allowNull: false
        },
        stock_minimo: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        maneja_vencimiento: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        time_limit_vencimiento: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 30,
        },
        imagen_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: 'Producto',
        tableName: 'Productos',
        timestamps: true,
    });
    return Producto;
};
