import { redirect } from "next/navigation";

// Vive como pestaña de Analytics.
export default function Page() {
  redirect("/analytics/insights");
}
