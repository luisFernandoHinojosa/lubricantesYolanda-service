import express from 'express';
import * as auditController from './audit.controller.js';

const router = express.Router();

router.route('/')
  .get(auditController.findAll)

router.route('/:id')
  .get(auditController.findOne)

export default router;
