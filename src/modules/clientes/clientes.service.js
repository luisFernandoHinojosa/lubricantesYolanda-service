import { clienteRepository } from './clientes.repository.js';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../errors/AppError.js'
import { eventEmitter } from '../../services/event.service.js';
import { sequelize } from '../../database/connection.js';
import { CI_CLIENTE_GENERICO } from '../../constants/business.constants.js';

// El cliente genérico lo usan las ventas sin cliente: no se puede crear, editar ni desactivar.
const esGenerico = (ci) => ci === CI_CLIENTE_GENERICO;

export class ClienteService {

  async getById(id) {
    const cliente = await clienteRepository.findById(id);
    if (!cliente) throw new NotFoundError(`Cliente con ID ${id}`);
    return cliente;
  }

  async getByCi(ci) {
    const cliente = await clienteRepository.findByCi(ci);
    if (!cliente) throw new NotFoundError(`Cliente con CI ${ci}`);
    return cliente;
  }

  async list(query) {
    return clienteRepository.findAllPaginated(query);
  }

  async create(data) {
    if (esGenerico(data.ci)) {
      throw new BusinessRuleError(`El CI ${CI_CLIENTE_GENERICO} está reservado para el cliente genérico`);
    }

    const existente = await clienteRepository.findByCi(data.ci);
    if (existente) {
      throw new ConflictError(`Ya existe un cliente activo con CI ${data.ci}`);
    }

    const cliente = await sequelize.transaction(async (t) => {
      return clienteRepository.create(data, { transaction: t });
    });

    eventEmitter.emit('cliente.created', {
      clienteId: cliente.id,
      ci: cliente.ci,
      nombre: cliente.nombre,
    });

    return cliente;
  }

  async update(id, data) {
    const cliente = await this.getById(id);

    if (esGenerico(cliente.ci)) {
      throw new BusinessRuleError('El cliente genérico no se puede modificar');
    }
    if (data.ci && esGenerico(data.ci)) {
      throw new BusinessRuleError(`El CI ${CI_CLIENTE_GENERICO} está reservado para el cliente genérico`);
    }
    if (Object.keys(data).length === 0) return cliente;

    // El CI debe ser único entre clientes activos: se valida al cambiarlo y al reactivar
    const cambiaCi = data.ci !== undefined && data.ci !== cliente.ci;
    const reactiva = data.esta_activo === true && !cliente.esta_activo;
    if (cambiaCi || reactiva) {
      const ci = data.ci ?? cliente.ci;
      const duplicado = await clienteRepository.findByCi(ci);
      if (duplicado && duplicado.id !== id) {
        throw new ConflictError(`Ya existe un cliente activo con CI ${ci}`);
      }
    }

    const updated = await sequelize.transaction(async (t) => {
      return clienteRepository.update(id, data, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Cliente con ID ${id}`);

    eventEmitter.emit('cliente.updated', { clienteId: id });
    return updated;
  }

  async ajustarPuntos(id, { puntos, motivo }, usuarioId = null) {
    const cliente = await this.getById(id);

    if (esGenerico(cliente.ci)) {
      throw new BusinessRuleError('El cliente genérico no acumula puntos');
    }
    if (!cliente.esta_activo) {
      throw new BusinessRuleError('No se pueden ajustar los puntos de un cliente inactivo');
    }

    const updated = await sequelize.transaction(async (t) => {
      return clienteRepository.ajustarPuntos(id, puntos, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Cliente con ID ${id}`);

    eventEmitter.emit('cliente.puntos_ajustados', {
      clienteId: id,
      variacion: puntos,
      puntosAnteriores: cliente.puntos,
      puntosActuales: updated.puntos,
      motivo: motivo ?? null,
      usuarioId,
    });

    return updated;
  }

  async remove(id) {
    const cliente = await this.getById(id);

    if (esGenerico(cliente.ci)) {
      throw new BusinessRuleError('El cliente genérico no se puede eliminar');
    }

    await sequelize.transaction(async (t) => {
      await clienteRepository.softDelete(id, { transaction: t });
    });

    eventEmitter.emit('cliente.deleted', { clienteId: id });
  }

  async getTop50ByPoints() {
    return clienteRepository.top50ByPoints();
  }

  async count() {
    return clienteRepository.count();
  }
}

export const clienteService = new ClienteService();
