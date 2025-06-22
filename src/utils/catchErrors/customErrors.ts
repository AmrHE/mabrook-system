
export class DB404Error extends Error {
  code: number;
  constructor (description = 'Not found.') {
    super(description);
    this.code = 404
    this.name = this.constructor.name;
  }
}
export class BadReqError extends Error {
  code: number;
  constructor (description = 'data no valid') {
    super(description);
    this.code = 400;
    this.name = this.constructor.name;
  }
}

export class UnauthorizedError extends Error {
  code: number;
  constructor (description = 'not permitted') {
    super(description);
    this.code = 401;
    this.name = this.constructor.name;
  }
}

type ValidatorError = {path: string, message: string}

export class ValidationError extends Error { // trying to replicate/simplify mongoose ValidationError https://github.com/Automattic/mongoose/blob/master/lib/error/validation.js
  errors : ValidatorError[] = []
  constructor (
    errors: ValidatorError[],
    description = 'invalid'
  ) {
    super(description);
    this.name = this.constructor.name;
    this.errors = errors
  }
}





