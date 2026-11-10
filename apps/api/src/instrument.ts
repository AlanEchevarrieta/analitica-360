import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['Authorization'];
          delete event.request.headers['cookie'];
          delete event.request.headers['Cookie'];
        }
      }
      if (event.user) {
        const { id } = event.user;
        const empresaId = (event.user as Record<string, unknown>)['empresaId'];
        event.user = id ? { id: String(id), ...(empresaId ? { empresaId: String(empresaId) } : {}) } : undefined;
      }
      return event;
    },
  });
}
