import { AnalyticsTabs } from "@/features/analytics/components/AnalyticsTabs";

export default function Layout({ children }: LayoutProps<"/analytics">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Analytics</h1>
      <AnalyticsTabs />
      {children}
    </div>
  );
}
