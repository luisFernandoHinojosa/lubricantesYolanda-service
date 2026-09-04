import { Model, DataTypes } from 'sequelize';

class Venta extends Model {
    static associate(models) {
        this.belongsTo(models.Sucursal, { foreignKey: 'id_sucursal', as: 'sucursal' });
        this.belongsTo(models.SesionCaja, { foreignKey: 'id_sesion_caja', as: 'sesion' });
        this.belongsTo(models.Empleado, { foreignKey: 'id_empleado', as: 'cajero' });
        this.belongsTo(models.Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
        this.hasMany(models.DetalleVenta, { foreignKey: 'id_venta', as: 'detalles' });
        this.hasMany(models.Devolucion, { foreignKey: 'id_venta_original', as: 'devoluciones' });
        this.hasMany(models.PagoVenta, { foreignKey: 'id_venta', as: 'pagos' });
    }
}

export default (sequelize) => {
    Venta.init({
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        numero_comprobante: {
            type: DataTypes.STRING(50),
            unique: true,
            allowNull: false,
        },
        id_sucursal: {
            type: DataTypes.UUID,
            allowNull: false
        },
        id_sesion_caja: {
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
        monto_pagado: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        cambio_entregado: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        // metodo_pago: {
        //     type: DataTypes.ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'QR'),
        //     allowNull: false
        // },
        notas: {
            type: DataTypes.TEXT
        },
        esta_activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
    }, {
        sequelize,
        modelName: 'Venta',
        tableName: 'Ventas',
        timestamps: true,
        updatedAt: false,
    });
    return Venta;
};