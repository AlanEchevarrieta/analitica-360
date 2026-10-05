import { AnalyticsTabs, EncabezadoAnalytics } from "@/features/analytics/components/AnalyticsTabs";

export default function Layout({ children }: LayoutProps<"/analytics">) {
  return (
    <div className="flex flex-col gap-4">
      <EncabezadoAnalytics />
      <AnalyticsTabs />
      {children}
    </div>
  );
}
