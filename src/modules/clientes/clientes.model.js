// src/modules/clientes/clientes.model.js
import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class Cliente extends Model {
    get nombreCompleto() {
      const partes = [this.nombre, this.apellido_paterno, this.apellido_materno];
      return partes.filter(Boolean).join(' ');
    }

    get esMayorDeEdad() {
      const hoy = new Date();
      const nacimiento = new Date(this.fecha_nacimiento);
      const edad = hoy.getFullYear() - nacimiento.getFullYear();
      return edad >= 18;
    }
  }

  Cliente.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      ci: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { notEmpty: true },
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true, len: [2, 100] },
      },
      apellido_paterno: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true },
      },
      apellido_materno: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      correo_electronico: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
        validate: { isEmail: true },
      },
      fecha_nacimiento: {
        type: DataTypes.DATEONLY,
        allowNull: false,
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
      puntos: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      genero: {
        type: DataTypes.ENUM('M', 'F', 'O'),
        allowNull: true,
        defaultValue: null,
      },
      tipo_cliente: {
        type: DataTypes.ENUM('MAY', 'MIN'),
        allowNull: false,
        defaultValue: 'MIN',
      },
      esta_activo: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'Cliente',
      tableName: 'Clientes',
      timestamps: true,
      paranoid: false,
      indexes: [
        { unique: true, fields: ['ci'], where: { esta_activo: true } },
        { fields: ['tipo_cliente', 'esta_activo'] },
        { fields: ['puntos'] },
      ],
    }
  );

  return Cliente;
};