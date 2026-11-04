import { Op, fn, col, literal, where as sqlWhere } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { CI_CLIENTE_GENERICO } from '../../constants/business.constants.js';

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

        // Además de cada campo por separado, se busca sobre el nombre completo
        // ("Juan Pérez Gómez" no coincide con ningún campo individual)
        if (query.search) {
            where[Op.or].push(
                sqlWhere(
                    fn('concat_ws', ' ', col('nombre'), col('apellido_paterno'), col('apellido_materno')),
                    { [Op.iLike]: `%${query.search}%` }
                )
            );
        }

        where.ci = { [Op.ne]: CI_CLIENTE_GENERICO };

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

    // Suma `delta` (puede ser negativo) en una sola sentencia, sin bajar de 0
    async ajustarPuntos(id, delta, { transaction } = {}) {
        const [, [updated]] = await this.clienteModel.update(
            { puntos: fn('GREATEST', 0, literal(`"puntos" + ${Number(delta)}`)) },
            { where: { id }, returning: true, transaction }
        );
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
            where: { esta_activo: true, ci: { [Op.ne]: CI_CLIENTE_GENERICO } },
            order: [['puntos', 'DESC']],
            limit: 50,
            transaction,
        });
    }
}

export const clienteRepository = new ClienteRepository();
