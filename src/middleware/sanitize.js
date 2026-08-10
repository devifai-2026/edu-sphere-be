/**
 * Strips Mongo operator keys ("$gt", "$where", …) and dotted paths from
 * request input so query-string/body values can never be promoted into
 * Mongo query operators (e.g. `?college[$ne]=null`).
 */
function clean(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = clean(value[i]);
    return value;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete value[key];
        continue;
      }
      value[key] = clean(value[key]);
    }
    return value;
  }
  return value;
}

export function sanitizeInput(req, _res, next) {
  if (req.query) clean(req.query);
  if (req.body) clean(req.body);
  if (req.params) clean(req.params);
  next();
}
