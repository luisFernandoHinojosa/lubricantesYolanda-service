import { Model, DataTypes } from 'sequelize';

class Proforma extends Model {
    static associate(models) {
        this.belongsTo(models.Sucursal, { foreignKey: 'id_sucursal', as: 'sucursal' });
        this.belongsTo(models.Empleado, { foreignKey: 'id_empleado', as: 'empleado' });
        this.belongsTo(models.Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
        this.hasMany(models.DetalleProforma, { foreignKey: 'id_proforma', as: 'detalles' });
        // Si se facturó, podríamos guardar la referencia a la venta, pero no es estrictamente necesario,
        // aunque es útil. Lo dejamos por ahora sin relación directa a Venta (o podríamos agregar id_venta_generada).
    }
}

export default (sequelize) => {
    Proforma.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        numero_proforma: {
            type: DataTypes.STRING(50),
            unique: true,
            allowNull: false,
        },
        id_sucursal: {
            type: DataTypes.UUID,
            allowNull: false
        },
        id_empleado: {
            type: DataTypes.UUID,
            allowNull: false
        },
        id_cliente: {
            type: DataTypes.UUID,
            allowNull: true
        },
        subtotal: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        tipo_descuento_global: {
            type: DataTypes.ENUM('PORCENTAJE', 'FIJO', 'NINGUNO'),
            allowNull: false,
            defaultValue: 'NINGUNO'
        },
        valor_descuento_global: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        monto_descuento_global: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0
        },
        total: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        validez_dias: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 15
        },
        estado: {
            type: DataTypes.ENUM('PENDIENTE', 'FACTURADA', 'VENCIDA', 'ANULADA'),
            allowNull: false,
            defaultValue: 'PENDIENTE'
        },
        notas: {
            type: DataTypes.TEXT
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'Proforma',
        tableName: 'Proformas',
        timestamps: true, // CreatedAt y UpdatedAt son útiles para cotizaciones
    });
    return Proforma;
};
