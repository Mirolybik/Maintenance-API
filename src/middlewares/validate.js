import { ValidationError } from '../errors/index.js';

export const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
    req.body = parsed.body;
    req.query = parsed.query;
    req.params = parsed.params;
    next();
  } catch (error) {
    const details = error.errors.map(err => ({ field: err.path.join('.'), message: err.message }));
    next(new ValidationError('Некорректные данные запроса', details));
  }
};
