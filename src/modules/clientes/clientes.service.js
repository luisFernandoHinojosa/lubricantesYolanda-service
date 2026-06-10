import { clienteRepository } from './clientes.repository.js';
import { NotFoundError, ConflictError } from '../../errors/AppError.js'
import { cache } from '../../services/cache.service.js';
import { eventEmitter } from '../../services/event.service.js';
import { sequelize } from '../../database/connection.js';

const CACHE_TTL = 300;
const cacheKey = (id) => `cliente:${id}`;

export class ClienteService {

  async getById(id) {
    const cached = await cache.get(cacheKey(id));
    if (cached) return cached;

    const cliente = await clienteRepository.findById(id);
    if (!cliente) throw new NotFoundError(`Cliente con ID ${id}`);

    await cache.set(cacheKey(id), cliente, CACHE_TTL);
    return cliente;
  }

  async list(query) {
    return clienteRepository.findAllPaginated({}, query);
  }

  async create(data) {
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
    await this.getById(id);

    const updated = await sequelize.transaction(async (t) => {
      return clienteRepository.update(id, data, { transaction: t });
    });

    if (!updated) throw new NotFoundError(`Cliente con ID ${id}`);

    await cache.del(cacheKey(id));

    eventEmitter.emit('cliente.updated', { clienteId: id });
    return updated;
  }

  async remove(id) {
    await this.getById(id);

    await sequelize.transaction(async (t) => {
      await clienteRepository.softDelete(id, { transaction: t });
    });

    await cache.del(cacheKey(id));
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