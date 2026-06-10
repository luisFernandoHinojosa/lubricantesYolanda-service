import { Model, DataTypes } from 'sequelize';

class Usuario extends Model {
  static associate(models) {
    this.belongsTo(models.Role, { foreignKey: 'rol_id' });
    this.belongsTo(models.Sucursal, { foreignKey: 'id_sucursal' });
    this.hasOne(models.Empleado, { foreignKey: 'usuario_id' });
  }
}

export default (sequelize) => {
  Usuario.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    rol_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    id_sucursal: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name_user: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    password_reset_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password_reset_expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    esta_activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'Usuario',
    tableName: 'Usuarios',
    timestamps: true,
  });
  return Usuario;
};