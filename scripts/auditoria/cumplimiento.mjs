// Matriz de cumplimiento: cruza OWASP ASVS 4.0 (nivel 2), SOC 2 (Trust
// Services Criteria), ISO/IEC 27001:2022 (Anexo A) y Ley 25.326 / GDPR.
// Cada requisito se evalúa con los controles automáticos que lo respaldan
// (`normas` de cada control) o, si es de procesos/documentos, con una
// evaluación manual explícita y su motivo. Revisar las manuales en cada auditoría.

/** estadoManual: cumple | parcial | falta. Solo para lo que no se puede medir con un script. */
export const MATRIZ = [
  // ---- OWASP ASVS 4.0, nivel 2 ----
  { clave: 'asvs-v1', marco: 'OWASP ASVS', ref: 'V1', titulo: 'Arquitectura y diseño seguro' },
  { clave: 'asvs-v2', marco: 'OWASP ASVS', ref: 'V2', titulo: 'Autenticación', estadoManual: 'parcial', motivo: 'La gestiona Clerk (contraseñas, bloqueo por intentos, verificación de email). Falta exigir doble factor (MFA) al menos a dueños y administradores.' },
  { clave: 'asvs-v2.10', marco: 'OWASP ASVS', ref: 'V2.10', titulo: 'Secretos de servicios fuera del código' },
  { clave: 'asvs-v3', marco: 'OWASP ASVS', ref: 'V3', titulo: 'Gestión de sesiones', estadoManual: 'cumple', motivo: 'Tokens de sesión de Clerk de vida corta (60 s), verificados en cada pedido; cierre de sesión revoca.' },
  { clave: 'asvs-v4', marco: 'OWASP ASVS', ref: 'V4', titulo: 'Control de acceso (multiempresa y roles)' },
  { clave: 'asvs-v5', marco: 'OWASP ASVS', ref: 'V5', titulo: 'Validación de entradas y codificación de salidas' },
  { clave: 'asvs-v7', marco: 'OWASP ASVS', ref: 'V7', titulo: 'Registro de eventos y su protección' },
  { clave: 'asvs-v8', marco: 'OWASP ASVS', ref: 'V8', titulo: 'Protección de datos', estadoManual: 'parcial', motivo: 'Datos aislados por empresa y sin claves en el código. Falta definir cifrado en reposo y retención de backups al elegir el hosting.' },
  { clave: 'asvs-v9', marco: 'OWASP ASVS', ref: 'V9', titulo: 'Comunicaciones cifradas (HTTPS/TLS)', estadoManual: 'parcial', motivo: 'Listo en deploy/Caddyfile: HTTPS automático con HSTS y certificados solo para tiendas activas. Se activa al publicar en el hosting; en local va por HTTP.' },
  { clave: 'asvs-v11', marco: 'OWASP ASVS', ref: 'V11', titulo: 'Lógica de negocio' },
  { clave: 'asvs-v13', marco: 'OWASP ASVS', ref: 'V13', titulo: 'API y límites de uso', estadoManual: 'cumple', motivo: 'Validación con Zod en todos los endpoints y límite de pedidos por minuto para todos (con y sin sesión), detrás del proxy con la IP real.' },
  { clave: 'asvs-v14', marco: 'OWASP ASVS', ref: 'V14', titulo: 'Configuración y dependencias' },
  { clave: 'asvs-v14.4', marco: 'OWASP ASVS', ref: 'V14.4', titulo: 'Cabeceras de seguridad HTTP' },

  // ---- SOC 2 ----
  { clave: 'soc2-cc4.1', marco: 'SOC 2', ref: 'CC4.1', titulo: 'Evaluación continua de los controles' },
  { clave: 'soc2-cc6.1', marco: 'SOC 2', ref: 'CC6.1', titulo: 'Acceso lógico restringido' },
  { clave: 'soc2-cc6.6', marco: 'SOC 2', ref: 'CC6.6', titulo: 'Protección frente a amenazas externas' },
  { clave: 'soc2-cc7.1', marco: 'SOC 2', ref: 'CC7.1', titulo: 'Detección de vulnerabilidades' },
  { clave: 'soc2-cc7.2', marco: 'SOC 2', ref: 'CC7.2', titulo: 'Monitoreo de actividad y anomalías' },
  { clave: 'soc2-cc7.4', marco: 'SOC 2', ref: 'CC7.3-7.5', titulo: 'Respuesta a incidentes', estadoManual: 'parcial', motivo: 'Borrador listo en Obsidian (Seguridad/Plan de respuesta a incidentes): falta aprobarlo, completar roles y hacer el primer simulacro.' },
  { clave: 'soc2-cc8.1', marco: 'SOC 2', ref: 'CC8.1', titulo: 'Gestión de cambios (código revisado y probado)' },
  { clave: 'soc2-a1.1', marco: 'SOC 2', ref: 'A1.1', titulo: 'Capacidad y rendimiento' },
  { clave: 'soc2-a1.2', marco: 'SOC 2', ref: 'A1.2', titulo: 'Backups' },
  { clave: 'soc2-a1.3', marco: 'SOC 2', ref: 'A1.3', titulo: 'Pruebas de recuperación' },
  { clave: 'soc2-pi1.2', marco: 'SOC 2', ref: 'PI1.2-1.3', titulo: 'Integridad del procesamiento (datos completos y exactos)' },
  { clave: 'soc2-c1.1', marco: 'SOC 2', ref: 'C1.1', titulo: 'Confidencialidad entre clientes' },
  { clave: 'soc2-p', marco: 'SOC 2', ref: 'P1-P8', titulo: 'Privacidad (aviso, consentimiento, acceso)', estadoManual: 'parcial', motivo: 'Política de privacidad v1.2 publicada y aceptada al registrarse; exportación de datos disponible. Falta un procedimiento de borrado a pedido.' },

  // ---- ISO/IEC 27001:2022, Anexo A ----
  { clave: 'iso-a5.1', marco: 'ISO 27001', ref: 'A.5.1', titulo: 'Políticas de seguridad de la información', estadoManual: 'parcial', motivo: 'Borrador listo en Obsidian (Seguridad/Política de seguridad): falta aprobarla (nombre y fecha).' },
  { clave: 'iso-a5.9', marco: 'ISO 27001', ref: 'A.5.9', titulo: 'Inventario de activos', estadoManual: 'parcial', motivo: 'La arquitectura está documentada en Obsidian; falta un inventario formal con dueño y clasificación de cada activo.' },
  { clave: 'iso-a5.17', marco: 'ISO 27001', ref: 'A.5.17', titulo: 'Información de autenticación' },
  { clave: 'iso-a5.24', marco: 'ISO 27001', ref: 'A.5.24-5.27', titulo: 'Gestión de incidentes', estadoManual: 'parcial', motivo: 'Igual que SOC 2 CC7.4: borrador del plan listo, falta aprobarlo y probarlo.' },
  { clave: 'iso-a5.30', marco: 'ISO 27001', ref: 'A.5.30', titulo: 'Continuidad del servicio' },
  { clave: 'iso-a8.4', marco: 'ISO 27001', ref: 'A.8.4', titulo: 'Acceso al código fuente' },
  { clave: 'iso-a8.6', marco: 'ISO 27001', ref: 'A.8.6', titulo: 'Gestión de la capacidad' },
  { clave: 'iso-a8.8', marco: 'ISO 27001', ref: 'A.8.8', titulo: 'Gestión de vulnerabilidades técnicas' },
  { clave: 'iso-a8.9', marco: 'ISO 27001', ref: 'A.8.9', titulo: 'Gestión de la configuración' },
  { clave: 'iso-a8.13', marco: 'ISO 27001', ref: 'A.8.13', titulo: 'Copias de seguridad' },
  { clave: 'iso-a8.15', marco: 'ISO 27001', ref: 'A.8.15', titulo: 'Registros (logging)' },
  { clave: 'iso-a8.16', marco: 'ISO 27001', ref: 'A.8.16', titulo: 'Monitoreo de actividades', estadoManual: 'parcial', motivo: 'Hay bitácora de cambios y registro de uso; falta alerta automática ante algo raro (ej. muchas anulaciones o bajas seguidas).' },
  { clave: 'iso-a8.28', marco: 'ISO 27001', ref: 'A.8.28', titulo: 'Codificación segura' },
  { clave: 'iso-a8.29', marco: 'ISO 27001', ref: 'A.8.29', titulo: 'Pruebas de seguridad' },

  // ---- Ley 25.326 (Argentina) / GDPR ----
  { clave: 'gdpr-5.1d', marco: 'Ley 25.326 / GDPR', ref: 'Art. 4 / GDPR 5.1.d', titulo: 'Datos exactos y actualizados' },
  { clave: 'gdpr-13', marco: 'Ley 25.326 / GDPR', ref: 'Art. 6 / GDPR 13', titulo: 'Informar al titular qué se guarda y para qué', estadoManual: 'cumple', motivo: 'Política de privacidad v1.2 con datos, uso, terceros (Clerk), plazos y el registro de uso de la app.' },
  { clave: 'gdpr-15', marco: 'Ley 25.326 / GDPR', ref: 'Art. 14 / GDPR 15 y 20', titulo: 'Acceso y portabilidad de los datos', estadoManual: 'cumple', motivo: 'Configuración → Exportar mis datos descarga todo el historial.' },
  { clave: 'gdpr-17', marco: 'Ley 25.326 / GDPR', ref: 'Art. 16 / GDPR 17', titulo: 'Supresión a pedido del titular', estadoManual: 'parcial', motivo: 'Se promete en la política, pero no hay un procedimiento ni una herramienta para borrar una cuenta completa (respetando la bitácora).' },
  { clave: 'gdpr-30', marco: 'Ley 25.326 / GDPR', ref: 'GDPR 30', titulo: 'Registro de actividades de tratamiento', estadoManual: 'parcial', motivo: 'Borrador listo en Obsidian (Seguridad/Registro de actividades de tratamiento): falta completar el responsable y decidir el plazo de la bitácora.' },
  { clave: 'gdpr-32', marco: 'Ley 25.326 / GDPR', ref: 'Art. 9 / GDPR 32', titulo: 'Seguridad del tratamiento' },
  { clave: 'gdpr-33', marco: 'Ley 25.326 / GDPR', ref: 'GDPR 33-34', titulo: 'Aviso de brechas de datos', estadoManual: 'parcial', motivo: 'El paso 6 del borrador del plan de incidentes define a quién avisar y en cuánto tiempo (72 h GDPR); falta aprobarlo.' },
  { clave: 'ley-21', marco: 'Ley 25.326 / GDPR', ref: 'Art. 21', titulo: 'Inscripción de las bases en el Registro Nacional (AAIP)', estadoManual: 'falta', motivo: 'Las bases con datos personales deben inscribirse en la AAIP. Pendiente antes de operar con clientes pagos.' },
];

/** Requisitos que heredan el resultado de otros controles automáticos (por nombre de norma). */
const TAMBIEN = { 'gdpr-32': ['asvs-v4', 'asvs-v14', 'iso-a8.8'], 'soc2-c1.1': ['asvs-v4'], 'soc2-cc4.1': ['soc2-cc7.2', 'soc2-cc7.1'], 'asvs-v11': ['soc2-pi1.2'] };

const ESTADO_MANUAL = { cumple: 'verde', parcial: 'amarillo', falta: 'rojo' };

export function evaluarMatriz(controles) {
  return MATRIZ.map((req) => {
    if (req.estadoManual) return { ...req, estado: ESTADO_MANUAL[req.estadoManual], como: 'manual', evidencia: req.motivo };
    const claves = [req.clave, ...(TAMBIEN[req.clave] ?? [])];
    const respaldos = controles.filter((c) => c.normas.some((n) => claves.includes(n)));
    if (respaldos.length === 0) return { ...req, estado: 'gris', como: 'automático', evidencia: 'Ningún control de esta corrida lo respalda.' };
    const orden = ['verde', 'gris', 'amarillo', 'rojo'];
    const estado = respaldos.map((c) => c.estado).reduce((a, b) => (orden.indexOf(b) > orden.indexOf(a) ? b : a), 'verde');
    return { ...req, estado, como: 'automático', evidencia: respaldos.map((c) => c.id).join(', ') };
  });
}
