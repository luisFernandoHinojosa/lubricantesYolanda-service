import { Model, DataTypes } from 'sequelize';

class Error extends Model {
  /**
   * Las asociaciones (relaciones con otras tablas) se definen aquí.
   * El cargador de modelos llamará a este método automáticamente.
   */
  static associate(models) {
    // Ejemplo: this.belongsTo(mdels.User, { foreignKey: 'userId' });
  }
}

export default (sequelize) => {
  Error.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stack: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'Error',
    tableName: 'Errors',
    timestamps: true,
  });

  return Error;
};