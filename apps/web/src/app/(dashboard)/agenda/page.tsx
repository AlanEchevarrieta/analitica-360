import { Agenda } from "@/features/agenda/Agenda";

export default async function Page(props: PageProps<"/agenda">) {
  const { fecha } = await props.searchParams;
  return <Agenda fechaInicial={typeof fecha === "string" ? fecha : null} />;
}
