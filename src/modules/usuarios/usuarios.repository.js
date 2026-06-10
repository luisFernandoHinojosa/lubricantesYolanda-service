import db from '../../database/index.js';

export class UsuarioRepository {
    constructor() {
        this.usuarioModel = db.Usuario;
    }

    async findById(id, { transaction } = {}) {
        return this.usuarioModel.findByPk(id, {
            include: [
                {
                    model: db.Empleado,
                    attributes: ['id', 'nombre', 'ci', 'apellido_paterno', 'apellido_materno']
                },
                {
                    model: db.Role,
                    attributes: ['id', 'nombre_rol', 'code_rol']
                }
            ],
            transaction
        });
    }

    async findByName(name, { transaction } = {}) {
        return this.usuarioModel.findOne({
            where: { name_user: name },
            include: [
                {
                    model: db.Empleado,
                    attributes: ['id', 'nombre', 'ci', 'apellido_paterno', 'apellido_materno']
                },
                {
                    model: db.Role,
                    attributes: ['id', 'nombre_rol', 'code_rol']
                }
            ],
            transaction
        });
    }

    async findByEmail(email, { transaction } = {}) {
        return this.usuarioModel.findOne({
            where: { email },
            include: [
                {
                    model: db.Empleado
                },
                {
                    model: db.Role,
                    attributes: ['nombre_rol', 'code_rol']
                }
            ],
            transaction
        });
    }

    async findAll({ transaction } = {}) {
        return this.usuarioModel.findAll({ transaction });
    }

    async create(data, options = {}) {
        return this.usuarioModel.create(data, options);
    }

    async update(id, data, { transaction } = {}) {
        const [, [updated]] = await this.usuarioModel.update(data, {
            where: { id },
            returning: true,
            transaction,
        });
        return updated ?? null;
    }

    async softDelete(id, { transaction } = {}) {
        return this.usuarioModel.update(
            { esta_activo: false },
            { where: { id }, transaction }
        );
    }

    async remove(id, { transaction } = {}) {
        return this.usuarioModel.destroy({
            where: { id },
            transaction
        });
    }

    async count({ transaction } = {}) {
        return this.usuarioModel.count({ transaction });
    }
}

export const usuarioRepository = new UsuarioRepository();
