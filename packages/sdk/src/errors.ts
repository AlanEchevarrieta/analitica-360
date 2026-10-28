export interface ValidationIssue {
  path?: string | (string | number)[];
  message: string;
}

export class Analitica360Error extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: ValidationIssue[];
  readonly raw?: unknown;

  constructor(message: string, status: number = 500, code: string = 'API_ERROR', issues?: ValidationIssue[], raw?: unknown) {
    super(message);
    this.name = 'Analitica360Error';
    this.status = status;
    this.code = code;
    this.issues = issues;
    this.raw = raw;
    Object.setPrototypeOf(this, Analitica360Error.prototype);
  }

  static fromResponse(status: number, body: unknown, defaultMessage: string = 'Error en la solicitud'): Analitica360Error {
    let message = defaultMessage;
    let code = `HTTP_${status}`;
    let issues: ValidationIssue[] | undefined;

    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      if (Array.isArray(b.issues) && b.issues.length > 0) {
        issues = b.issues as ValidationIssue[];
        const firstIssue = issues[0]?.message;
        if (firstIssue) message = firstIssue;
        code = 'VALIDATION_ERROR';
      } else if (typeof b.message === 'string') {
        message = b.message;
      } else if (Array.isArray(b.message) && typeof b.message[0] === 'string') {
        message = b.message[0];
      }

      if (typeof b.error === 'string') {
        code = b.error.toUpperCase().replace(/\s+/g, '_');
      }
    }

    if (status === 429) {
      code = 'RATE_LIMITED';
      message = 'Demasiadas solicitudes. Por favor, intentá de nuevo en unos momentos.';
    } else if (status === 404) {
      code = 'NOT_FOUND';
    } else if (status === 409) {
      code = 'CONFLICT';
    }

    return new Analitica360Error(message, status, code, issues, body);
  }
}
