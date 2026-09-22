import type { AccesoColaborador, Rol } from './rol.types.js';

/** Seteado por ClerkAuthGuard a partir del JWT verificado. */
export interface ClerkAuthContext {
  clerkUserId: string;
  clerkOrgId: string | null;
  sessionClaims: Record<string, unknown>;
}

/** Seteado por EmpresaScopeGuard, resolviendo el registro interno. */
export interface EmpresaContext {
  id: string;
  clerkOrgId: string;
  nombre: string;
}

export interface UsuarioContext {
  id: string;
  clerkUserId: string;
  empresaId: string;
  email: string;
  rol: Rol;
  acceso?: AccesoColaborador;
}

declare module 'express' {
  interface Request {
    clerkAuth?: ClerkAuthContext;
    empresa?: EmpresaContext;
    usuario?: UsuarioContext;
  }
}
