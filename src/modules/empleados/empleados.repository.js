import { Op } from 'sequelize';
import db from '../../database/index.js';
import { buildSequelizeQuery } from '../../utils/queryBuilder.js';
import { EMPLEADO_CONFIG } from '../../common/applyFilters.js';
import { EMPLEADO_EXCLUDED, ROLE_EXCLUDE, USUARIO_EXCLUDED } from '../../common/attributeExclude.js';

export class EmpleadoRepository {
    constructor() {
        this.empleadoModel = db.Empleado;
    }

    async findById(id, { transaction } = {}) {
        return this.empleadoModel.findByPk(id, {
            include: [
                {
                    model: db.Usuario,
                    attributes: { exclude: USUARIO_EXCLUDED },
                    include: [
                        {
                            model: db.Role,
                            attributes: { exclude: ROLE_EXCLUDE },
                        },
                    ],
                },
            ],
            transaction,
        });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, EMPLEADO_CONFIG);

        const { rows, count } = await this.empleadoModel.findAndCountAll({
            where: {
                ...where,
                esta_activo: true,
            },
            limit,
            offset,
            order,
            include: [
                {
                    model: db.Usuario,
                    attributes: ['id', 'name_user', 'email'],
                    include: [
                        {
                            model: db.Role,
                            attributes: { exclude: ROLE_EXCLUDE },
                        },
                    ],
                },
            ],
            transaction,
        });

        return {
            empleados: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAll({ transaction } = {}) {
        return this.empleadoModel.findAll({ transaction });
    }

    async findAllExtraData({ transaction } = {}) {
        return this.empleadoModel.findAll({
            attributes: { exclude: EMPLEADO_EXCLUDED },
            where: { esta_activo: true },
            transaction,
        });
    }

    async findAllPromotores({ transaction } = {}) {
        return this.empleadoModel.findAll({
            include: [
                {
                    model: db.Usuario,
                    required: true,
                    include: [
                        {
                            model: db.Role,
                            required: true,
                            where: { code_rol: 'PTOR' },
                            attributes: { exclude: ROLE_EXCLUDE },
                        },
                    ],
                    attributes: { exclude: USUARIO_EXCLUDED },
                },
            ],
            attributes: { exclude: EMPLEADO_EXCLUDED },
            where: { esta_activo: true },
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.empleadoModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.empleadoModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.empleadoModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }

    async count({ transaction } = {}) {
        return this.empleadoModel.count({ transaction });
    }
}

export const empleadoRepository = new EmpleadoRepository();
