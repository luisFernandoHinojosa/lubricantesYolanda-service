import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { PROFORMA_CONFIG } from '../../common/applyFilters.js';

export class ProformaRepository {
    constructor() {
        this.proformaModel = db.Proforma;
        this.detalleModel = db.DetalleProforma;
    }

    async findById(id, { transaction } = {}) {
        return this.proformaModel.findByPk(id, {
            include: [
                {
                    model: db.Cliente,
                    as: 'cliente',
                    attributes: ['id', 'nombre', 'ci', 'apellido_paterno', 'apellido_materno', 'telefono'],
                },
                {
                    model: db.Empleado,
                    as: 'empleado',
                    attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno'],
                },
                {
                    model: db.DetalleProforma,
                    as: 'detalles',
                    include: [
                        {
                            model: db.Producto,
                            as: 'producto',
                            attributes: ['id', 'nombre_comercial', 'codigo_barras'],
                            include: [
                                {
                                    model: db.UnidadMedida,
                                    as: 'unidad_medida',
                                    attributes: ['id', 'nombre', 'abreviatura'],
                                },
                            ],
                        },
                        {
                            model: db.Presentacion,
                            as: 'presentacion',
                            attributes: ['id', 'nombre', 'factor_conversion'],
                        },
                    ],
                },
            ],
            transaction
        });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } = buildSequelizeQuery(query, PROFORMA_CONFIG);
        
        if (query.id_sucursal) where.id_sucursal = query.id_sucursal;
        if (query.estado) where.estado = query.estado;
        if (query.id_cliente) where.id_cliente = query.id_cliente;
        if (query.desde || query.hasta) {
            where.createdAt = {};
            if (query.desde) where.createdAt[Op.gte] = new Date(query.desde);
            if (query.hasta) where.createdAt[Op.lte] = new Date(query.hasta);
        }

        const { rows, count } = await this.proformaModel.findAndCountAll({
            where,
            limit,
            offset,
            order: order || [['createdAt', 'DESC']],
            distinct: true,
            include: [
                {
                    model: db.Cliente,
                    as: 'cliente',
                    attributes: ['id', 'nombre', 'apellido_paterno', 'ci']
                },
                {
                    model: db.Empleado,
                    as: 'empleado',
                    attributes: ['id', 'nombre', 'apellido_paterno', 'apellido_materno']
                }
            ],
            transaction,
        });

        return {
            proformas: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async countByPrefix(prefijo, id_sucursal, { transaction } = {}) {
        return this.proformaModel.count({
            where: { numero_proforma: { [Op.like]: `${prefijo}%` }, id_sucursal },
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.proformaModel.create(data, { transaction });
    }

    async createDetalles(detalles, { transaction } = {}) {
        return this.detalleModel.bulkCreate(detalles, { transaction });
    }

    async updateEstado(id, estado, { transaction } = {}) {
        return this.proformaModel.update({ estado }, { where: { id }, transaction });
    }
}

export const proformaRepository = new ProformaRepository();
