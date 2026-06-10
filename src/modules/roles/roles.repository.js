import db from '../../database/index.js';

export class RoleRepository {
    constructor() {
        this.roleModel = db.Role;
    }

    async findById(id, { transaction } = {}) {
        return this.roleModel.findByPk(id, { transaction });
    }

    async findAll({ transaction } = {}) {
        return this.roleModel.findAll({
            order: [['nombre_rol', 'ASC']],
            transaction,
        });
    }

    async findAllPaginated(query = {}, { transaction } = {}) {
        const { where, limit, offset, order, page, perPage } =
            buildSequelizeQuery(query, ROL_CONFIG);

        const { rows, count } = await this.rolModel.findAndCountAll({
            where: {
                ...where,
                esta_activo: true,
            },
            limit,
            offset,
            order,
            transaction,
        });

        return {
            roles: rows,
            total: count,
            page,
            perPage,
            totalPages: Math.ceil(count / perPage),
        };
    }

    async findAllCatalogo({ transaction } = {}) {
        return this.roleModel.findAll({
            // attributes: ['id', 'nombre_rol', 'code_rol'],
            where: { esta_activo: true },
            order: [['nombre_rol', 'ASC']],
            transaction,
        });
    }

    async create(data, { transaction } = {}) {
        return this.roleModel.create(data, { transaction });
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.roleModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async remove(id, { transaction } = {}) {
        return this.roleModel.destroy({
            where: { id },
            transaction
        });
    }
}

export const roleRepository = new RoleRepository();
