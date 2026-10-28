import { Router } from 'express';
import * as service from './tables.service.js';

export const tablesRouter = Router();

tablesRouter.get('/', async (_req, res, next) => {
  try {
    const tables = await service.listTables();
    res.json(tables);
  } catch (error) {
    next(error);
  }
});

tablesRouter.post('/', async (req, res, next) => {
  try {
    const table = await service.createTable(req.body?.name, req.body?.capacity);
    res.status(201).json(table);
  } catch (error) {
    next(error);
  }
});

tablesRouter.patch('/:id/status', async (req, res, next) => {
  try {
    const table = await service.changeTableStatus(req.params.id, req.body?.status);

    if (!table) {
      res.status(404).json({
        code: 'TABLE_NOT_FOUND',
        message: 'Mesa no encontrada',
      });
      return;
    }

    res.json(table);
  } catch (error) {
    next(error);
  }
});
