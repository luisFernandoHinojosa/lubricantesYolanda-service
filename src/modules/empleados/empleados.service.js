import { empleadoRepository } from './empleados.repository.js';
import { NotFoundError } from '../../errors/AppError.js';
import { sequelize } from '../../database/connection.js';
import { usuariosService } from '../usuarios/usuarios.service.js';

export class EmpleadoService {

  async getById(id) {
    const empleado = await empleadoRepository.findById(id);
    if (!empleado) throw new NotFoundError(`Empleado con ID ${id}`);
    return empleado;
  }

  async list(query) {
    return empleadoRepository.findAllPaginated(query);
  }

  async listAll() {
    return empleadoRepository.findAll();
  }

  async listExtraData() {
    return empleadoRepository.findAllExtraData();
  }

  async listPromotores() {
    return empleadoRepository.findAllPromotores();
  }

  async create(data) {
    return await sequelize.transaction(async (t) => {
      let usuarioId = data.usuario_id;
      
      if (data.usuario) {
        const nuevoUsuario = await usuariosService.create(data.usuario, { transaction: t });
        usuarioId = nuevoUsuario.id;
      }
      
      return empleadoRepository.create({
        ...data,
        usuario_id: usuarioId || null
      }, { transaction: t });
    });
  }

  async update(id, data) {
    const empleado = await this.getById(id);
    
    const updated = await sequelize.transaction(async (t) => {
      const { usuario, ...datosEmpleado } = data;
      
      // Si se envía la propiedad usuario, manejamos su actualización, creación o eliminación
      if (usuario !== undefined) {
        if (usuario === null) {
          // Escenario: Quitar el usuario del empleado (Frontend envía usuario: null)
          if (empleado.usuario_id) {
            // Podemos desactivar el usuario lógicamente
            await usuariosService.softDelete(empleado.usuario_id, { transaction: t });
            // Y desvincularlo del empleado
            datosEmpleado.usuario_id = null;
          }
        } else {
          // Escenario: Actualizar usuario existente o Crear uno nuevo
          if (empleado.usuario_id) {
            // Actualizar usuario existente (ej. cambiar esta_activo a false)
            await usuariosService.update(empleado.usuario_id, usuario, { transaction: t });
          } else {
            // Crear nuevo usuario para este empleado
            const nuevoUsuario = await usuariosService.create(usuario, { transaction: t });
            datosEmpleado.usuario_id = nuevoUsuario.id;
          }
        }
      }
      
      // Update employee data
      const updatedEmpleado = await empleadoRepository.update(id, datosEmpleado, { transaction: t });
      if (!updatedEmpleado) throw new NotFoundError(`Empleado con ID ${id}`);
      
      return updatedEmpleado;
    });
    
    // Re-fetch with associations to return complete data
    return this.getById(id);
  }

  async remove(id) {
    const empleado = await this.getById(id);
    
    await sequelize.transaction(async (t) => {
      // Soft delete the employee
      await empleadoRepository.softDelete(id, { transaction: t });
      
      // Soft delete the associated user if exists
      if (empleado.usuario_id) {
        await usuariosService.softDelete(empleado.usuario_id, { transaction: t });
      }
    });
  }

  async count() {
    return empleadoRepository.count();
  }
}

export const empleadosService = new EmpleadoService();

// Exporting these specific functions for compatibility
export const findAllExtraDataEmpleado = async () => {
  return await empleadosService.listExtraData();
};

export const findAllExtraDataPromotor = async () => {
  return await empleadosService.listPromotores();
};

export const countEmpleados = async () => {
  return await empleadosService.count();
};