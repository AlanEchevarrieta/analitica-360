import { redirect } from "next/navigation";

export default function RadarPreciosRedirect() {
  redirect("/productos?tab=radar");
}

