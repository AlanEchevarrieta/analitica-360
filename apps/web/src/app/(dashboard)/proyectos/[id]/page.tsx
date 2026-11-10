import { ProyectoFicha } from "@/features/proyectos/ProyectoFicha";

export default async function Page(props: PageProps<"/proyectos/[id]">) {
  const { id } = await props.searchParams.then(() => props.params);
  return <ProyectoFicha id={id} />;
}
