import { Model, DataTypes } from 'sequelize';

class CategoriaMovimiento extends Model {
    static associate(models) {
        this.hasMany(models.Movimiento, { foreignKey: 'categoriaMovimientoId', as: 'movimientos' });
    }
}

export default (sequelize) => {
    CategoriaMovimiento.init({
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
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
        tipo: {
            type: DataTypes.ENUM('INGRESO', 'EGRESO'),
            allowNull: false,
            defaultValue: 'EGRESO',
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'CategoriaMovimiento',
        tableName: 'CategoriasMovimientos',
        timestamps: true,
    });
    return CategoriaMovimiento;
};
