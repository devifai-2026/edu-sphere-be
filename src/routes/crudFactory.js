import { Router } from 'express';

/**
 * Generic admin CRUD router for a publishable content model.
 * Admin sees ALL docs (any status, incl. soft-deleted unless filtered).
 * Provides: list, get, create, update, status change, soft delete, restore.
 */
export function crudRouter(Model, { defaultSort = '-createdAt' } = {}) {
  const router = Router();

  // list — supports ?status=&search=&limit=&skip=; hides soft-deleted by default
  router.get('/', async (req, res) => {
    const { status, includeDeleted, limit = 200, skip = 0 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (!includeDeleted) filter.deletedAt = null;
    const docs = await Model.find(filter).sort(defaultSort).limit(Number(limit)).skip(Number(skip)).lean();
    res.json(docs);
  });

  router.get('/:id', async (req, res) => {
    const doc = await Model.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  });

  router.post('/', async (req, res) => {
    try {
      const doc = await Model.create(req.body || {});
      res.status(201).json(doc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const doc = await Model.findByIdAndUpdate(req.params.id, { $set: req.body || {} }, { new: true, runValidators: true });
      if (!doc) return res.status(404).json({ error: 'not found' });
      res.json(doc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // publish / hide / draft
  router.patch('/:id/status', async (req, res) => {
    const { status } = req.body || {};
    if (!['draft', 'published', 'hidden'].includes(status)) return res.status(400).json({ error: 'bad status' });
    const patch = { status };
    if (status === 'published') patch.publishedAt = new Date();
    const doc = await Model.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  });

  // soft delete / restore
  router.patch('/:id/delete', async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, { $set: { deletedAt: new Date() } }, { new: true });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  });
  router.patch('/:id/restore', async (req, res) => {
    const doc = await Model.findByIdAndUpdate(req.params.id, { $set: { deletedAt: null } }, { new: true });
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  });

  return router;
}
