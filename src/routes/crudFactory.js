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
    // A negative limit/skip throws inside the MongoDB driver (500, not 400);
    // a non-numeric one (e.g. "abc" → NaN) was silently treated as "no limit"
    // by .limit(NaN), returning every row unbounded instead of rejecting it.
    const limitNum = Number(limit);
    const skipNum = Number(skip);
    if (!Number.isFinite(limitNum) || limitNum < 0 || !Number.isFinite(skipNum) || skipNum < 0) {
      return res.status(400).json({ error: 'limit and skip must be non-negative numbers' });
    }
    const filter = {};
    if (status) filter.status = status;
    if (!includeDeleted) filter.deletedAt = null;
    const docs = await Model.find(filter).sort(defaultSort).limit(limitNum).skip(skipNum).lean();
    res.json(docs);
  });

  router.get('/:id', async (req, res) => {
    const doc = await Model.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  });

  router.post('/', async (req, res) => {
    // Model.create([]) on an array body silently creates zero documents and
    // reports success — reject anything that isn't a plain object up front.
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'request body must be a JSON object' });
    }
    try {
      const doc = await Model.create(req.body);
      res.status(201).json(doc);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.put('/:id', async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({ error: 'request body must be a JSON object' });
    }
    try {
      const doc = await Model.findById(req.params.id);
      if (!doc) return res.status(404).json({ error: 'not found' });
      // findByIdAndUpdate + runValidators binds `this` in custom validators to
      // the query, not the document — a validator reading a sibling field
      // (e.g. Job.salaryMax comparing against salaryMin) silently sees
      // undefined and never rejects on update, only on create. Load-modify-
      // save runs the exact same validation path .create() uses.
      const { _id, __v, ...patch } = req.body;
      Object.assign(doc, patch);
      await doc.save();
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
