import { Op } from 'sequelize';
export const buildSequelizeQuery = (query, config) => {
  const {
    searchableFields = [],
    filterableFields = [],
    defaultSort = ['id', 'ASC'],
    allowedSortFields = [],
  } = config;

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(query.perPage, 10) || 20));
  const offset = (page - 1) * perPage;

  let where = {};
  let order = [defaultSort];

  if (query.search && searchableFields.length > 0) {
    where[Op.or] = searchableFields.map((field) => ({
      [field]: { [Op.iLike]: `%${query.search}%` },
    }));
  }

  const safeSortFields = allowedSortFields.length > 0
    ? allowedSortFields
    : [defaultSort[0]];

  if (query.sortBy && safeSortFields.includes(query.sortBy)) {
    const direction = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    order = [[query.sortBy, direction]];
  }

  const reserved = new Set(['page', 'perPage', 'search', 'sortBy', 'sortOrder']);

  for (const key of filterableFields) {
    if (reserved.has(key)) continue;
    const value = query[key];
    if (value !== undefined && value !== null && value !== '') {
      where[key] = value;
    }
  }

  return { where, limit: perPage, offset, order, page, perPage };
};