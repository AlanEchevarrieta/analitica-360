"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/nextjs";
import { useApiFetch } from "@/hooks/use-api";

export interface Proveedor {
  id: string;
  nombre: string;
  razonSocial: string | null;
  nombreComercial: string | null;
  cuit: string | null;
  condicionAfip: string | null;
  nombreVendedor: string | null;
  telefono: string | null;
  email: string | null;
  productosQueProvee: string | null;
  condicionesPago: string | null;
  formasPagoAceptadas: string[];
  plazoEntrega: string | null;
  cbu: string | null;
  aliasCbu: string | null;
  banco: string | null;
  notas: string | null;
  activo: boolean;
}

export type DatosProveedor = Omit<Proveedor, "id">;

export interface FichaProveedor {
  proveedor: Proveedor;
  compras: { id: string; fecha: string; productos: string; total: number; notas: string | null }[];
}

export function useProveedoresLista(busqueda: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  const params = new URLSearchParams({ pagina: "1", pageSize: "200" });
  if (busqueda.trim()) params.set("busqueda", busqueda.trim());
  return useQuery({
    queryKey: ["proveedores-lista", orgId, busqueda],
    queryFn: () => api<{ items: Proveedor[]; total: number }>(`/proveedores?${params}`),
    enabled: Boolean(orgId),
  });
}

export function useProveedor(id: string) {
  const api = useApiFetch();
  const { orgId } = useAuth();
  return useQuery({ queryKey: ["proveedor", orgId, id], queryFn: () => api<FichaProveedor>(`/proveedores/${id}`), enabled: Boolean(orgId) });
}

export function useGuardarProveedor() {
  const api = useApiFetch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id: string | null; datos: DatosProveedor }) =>
      api<Proveedor>(id ? `/proveedores/${id}` : "/proveedores", { method: id ? "PATCH" : "POST", body: JSON.stringify(datos) }),
    onSuccess: () => {
      for (const k of ["proveedores", "proveedores-lista", "proveedor"]) void queryClient.invalidateQueries({ queryKey: [k] });
    },
  });
}
