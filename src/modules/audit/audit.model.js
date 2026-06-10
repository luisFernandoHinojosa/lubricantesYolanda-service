import { Model, DataTypes } from 'sequelize';

class Audit extends Model {
  /**
   * Las asociaciones (relaciones con otras tablas) se definen aquí.
   * El cargador de modelos llamará a este método automáticamente.
   */
  static associate(models) {
    // Ejemplo: this.belongsTo(models.User, { foreignKey: 'userId' });
  }
}

export default (sequelize) => {
  Audit.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    requestBody: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    responseStatus: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    esta_activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  }, {
    sequelize,
    modelName: 'Audit',
    tableName: 'Audits',
    timestamps: true,
  });

  return Audit;
};