---
type: "query"
date: "2026-11-18T22:49:11.173789+00:00"
question: "como se que esta todo el tema de superadmin y como lo pruebo con q users y todo"
contributor: "graphify"
outcome: "useful"
source_nodes: ["AdminAppGuard", "AdminAccesoController", "AdminSaasController", "AdminSuscripcionController", "ConsolaShell", "AppSidebar"]
---

# Q: como se que esta todo el tema de superadmin y como lo pruebo con q users y todo

## Answer

Expanded from original query via vocab: [admin, saas, administrador, rol, roles, guard, clerk, usuario, usuarios, acceso, prueba, suscripcion]. Superadmin en Analitica 360 no es un rol de Clerk ni de la tabla usuarios, sino que se controla con la tabla admin_emails verificada por AdminAppGuard (@RequireAdminApp) despues de ClerkAuthGuard y EmpresaScopeGuard. El frontend consulta GET /admin/yo (AdminAccesoController) mediante useEsAdmin() para mostrar Consola en AppSidebar y habilitar ConsolaShell en /admin.

## Outcome

- Signal: useful

## Source Nodes

- AdminAppGuard
- AdminAccesoController
- AdminSaasController
- AdminSuscripcionController
- ConsolaShell
- AppSidebar