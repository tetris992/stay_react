// src/utils/ApiError.js

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.message = message;
  }
}

export default ApiError;
