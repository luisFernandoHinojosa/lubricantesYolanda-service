// src/modules/clientes/clientes.model.js
import { Model, DataTypes } from 'sequelize';
import { TIPO_DOCUMENTO_IDENTIDAD, TIPOS_DOCUMENTO_IDENTIDAD_VALIDOS } from '../../constants/business.constants.js';

export default (sequelize) => {
  class Cliente extends Model {
    get nombreCompleto() {
      const partes = [this.nombre, this.apellido_paterno, this.apellido_materno];
      return partes.filter(Boolean).join(' ');
    }

    get esMayorDeEdad() {
      if (!this.fecha_nacimiento) return null;
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
      ci: {// O NIT
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { notEmpty: true },
      },
      // Código SIAT del tipo de documento: 1=CI, 2=CEX, 3=PAS, 4=OD, 5=NIT
      tipo_documento: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: TIPO_DOCUMENTO_IDENTIDAD.CI,
        validate: { isIn: [TIPOS_DOCUMENTO_IDENTIDAD_VALIDOS] },
      },
      complemento: {
        type: DataTypes.STRING(5),
        allowNull: true,
        defaultValue: null,
      },
      nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: { notEmpty: true, len: [2, 100] },
      },
      apellido_paterno: {
        type: DataTypes.STRING(100),
        allowNull: true,
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
        allowNull: true,
      },
      telefono: {
        type: DataTypes.STRING(50),
        allowNull: false,
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