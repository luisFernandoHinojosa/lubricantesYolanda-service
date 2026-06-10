import asyncHandler from '../../utils/asyncHandler.js';
import * as auditService from './audit.service.js';

export const findAll = asyncHandler(async (req, res, next) => {
  const audits = await auditService.findAllAudits();
  res.status(200).json({ status: 'success', data: audits });
});

export const findOne = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const audit = await auditService.findAuditById(id);
  if (!audit) {
     return res.status(404).json({
      status: 'error',
      message: `El registro de auditoria con ID ${id} no fue encontrado.`,
    });
  }
  res.status(200).json({ status: 'success', data: audit });
});
