import { UsoUsuarioVista } from "@/features/admin/components/UsoUsuarioVista";

const DIAS = [1, 7, 30, 90] as const;

export default async function Page(props: PageProps<"/admin/uso/usuarios/[id]">) {
  const [{ id }, q] = await Promise.all([props.params, props.searchParams]);
  const dias = DIAS.find((d) => String(d) === q.dias) ?? 30;
  return <UsoUsuarioVista id={id} dias={dias} />;
}
