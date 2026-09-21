/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ENV?: string
  readonly VITE_ADMIN_EMAIL?: string
  readonly VITE_WHATSAPP_CONTACT?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_RESEND_API_KEY?: string
  readonly VITE_FROM_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
