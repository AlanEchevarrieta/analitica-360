import * as Sentry from '@sentry/react'

const SENSITIVE_FIELDS = ['password', 'email', 'telefono', 'cbu', 'cuit', 'token'] as const

export function initSentry() {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    enabled: import.meta.env.PROD,
    beforeSend(event) {
      const data = event.request?.data
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const rec = data as Record<string, unknown>
        for (const field of SENSITIVE_FIELDS) {
          if (rec[field]) rec[field] = '[REDACTED]'
        }
      }
      return event
    },
  })
}
