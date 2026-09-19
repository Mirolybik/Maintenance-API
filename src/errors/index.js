export class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
export class NotFoundError extends AppError {
  constructor(message) { super(message, 404, 'NOT_FOUND'); }
}
export class ValidationError extends AppError {
  constructor(message, details) { super(message, 422, 'VALIDATION_ERROR', details); }
}
export class ConflictError extends AppError {
  constructor(message) { super(message, 409, 'CONFLICT'); }
}
