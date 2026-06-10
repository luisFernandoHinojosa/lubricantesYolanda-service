import { Model, DataTypes } from 'sequelize';

class Role extends Model {
  static associate(models) {
    this.hasMany(models.Usuario, { foreignKey: 'rol_id' });
  }
}

export default (sequelize) => {
  Role.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code_rol: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
    },
    nombre_rol: {
      type: DataTypes.STRING(50),
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
    },
  }, {
    sequelize,
    modelName: 'Role',
    tableName: 'Roles',
    timestamps: true,
  });
  return Role;
};