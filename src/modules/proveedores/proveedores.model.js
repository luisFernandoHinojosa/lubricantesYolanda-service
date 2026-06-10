import { Model, DataTypes } from 'sequelize';

class Proveedor extends Model {
}

export default (sequelize) => {
  Proveedor.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nit_ci: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    razon_social: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    contacto: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },
    apellido_paterno: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    apellido_materno: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    empresa: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    telefono: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
    },
    direccion: {
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
    modelName: 'Proveedor',
    tableName: 'Proveedores',
    timestamps: true,
  });
  return Proveedor;
};