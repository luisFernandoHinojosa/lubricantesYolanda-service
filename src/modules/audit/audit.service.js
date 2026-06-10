import db from '../../database/index.js';

export const findAllAudits = async () => {
  return await db.Audit.findAll();
};

export const findAuditById = async (id) => {
  const audit = await db.Audit.findByPk(id);
  return audit;
};

export const createAudit = async (auditData) => {
  return await db.Audit.create(auditData);
};