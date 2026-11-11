// src/lib/errors.js

// A problem with an uploaded statement. The message is user-facing and is shown as it is.
export class StatementError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StatementError';
  }
}
