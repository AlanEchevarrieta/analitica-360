import { TicketAdminVista } from "@/features/admin/components/SoporteAdminVista";

export default async function Page(props: PageProps<"/admin/soporte/[id]">) {
  const { id } = await props.params;
  return <TicketAdminVista id={id} />;
}
