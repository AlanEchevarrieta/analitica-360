import { CamaraFichaVista } from "@/features/admin/components/alianzas/CamaraFichaVista";

export default async function Page(props: PageProps<"/admin/alianzas/[id]">) {
  const { id } = await props.params;
  return <CamaraFichaVista id={id} />;
}
