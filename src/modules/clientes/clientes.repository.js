import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';

const CLIENTE_QUERY_CONFIG = {
    searchableFields: ['nombre', 'apellido_paterno', 'ci'],
    filterableFields: ['tipo_cliente', 'esta_activo'],
    defaultSort: ['createdAt', 'DESC'],
    allowedSortFields: ['createdAt', 'nombre', 'puntos', 'apellido_paterno'],
};

export class ClienteRepository {

    constructor() {
        this.clienteModel = db.Cliente;
    }

    async findById(id, { transaction } = {}) {
        return this.clienteModel.findByPk(id, { transaction });
    }

    async findByCi(ci, { transaction } = {}) {
        return this.clienteModel.findOne({
            where: { ci, esta_activo: true },
            transaction,
        });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, CLIENTE_QUERY_CONFIG);

        where.ci = { [Op.ne]: '000000' };

        const { rows, count } = await this.clienteModel.findAndCountAll({
            where,
            limit,
            offset,
            order,
            transaction,
        });

        return {
            clientes: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async create(data, { transaction } = {}) {
        return this.clienteModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.clienteModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.clienteModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }

    async count({ transaction } = {}) {
        return this.clienteModel.count({ where: { esta_activo: true }, transaction });
    }

    async top50ByPoints({ transaction } = {}) {
        return this.clienteModel.findAll({
            attributes: ['id', 'nombre', 'puntos', 'apellido_paterno', 'apellido_materno'],
            where: { esta_activo: true },
            order: [['puntos', 'DESC']],
            limit: 50,
            transaction,
        });
    }
}

export const clienteRepository = new ClienteRepository();