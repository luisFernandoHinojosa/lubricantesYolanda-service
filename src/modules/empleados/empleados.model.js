import { Model, DataTypes } from 'sequelize';

class Empleado extends Model {
  static associate(models) {
    this.belongsTo(models.Usuario, { foreignKey: 'usuario_id' });
    // this.hasMany(models.Usuario, { foreignKey: 'empleado_id' });
    this.hasMany(models.Movimiento, { foreignKey: 'empleadoId', as: 'movimientos' });
  }
}

export default (sequelize) => {
  Empleado.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    usuario_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Usuarios',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    ci: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    fecha_despido: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    apellido_paterno: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    apellido_materno: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    cargo: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    fecha_nacimiento: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    fecha_contratacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    salario_base: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    },
    telefono: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    direccion: {
      type: DataTypes.STRING(255),
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
    modelName: 'Empleado',
    tableName: 'Empleados',
    timestamps: true,
  });
  return Empleado;
};