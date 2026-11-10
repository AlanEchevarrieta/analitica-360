import { obtenerCatalogo } from "@/lib/api";
import { HeroEditorial } from "@/components/home/HeroEditorial";
import { FeaturedEditorial } from "@/components/home/FeaturedEditorial";
import { RitualSection } from "@/components/home/RitualSection";
import { MaterialsSection } from "@/components/home/MaterialsSection";

export const revalidate = 60;

export default async function HomePage() {
  const productos = await obtenerCatalogo();

  return (
    <>
      <HeroEditorial />
      <FeaturedEditorial productos={productos} />
      <RitualSection />
      <MaterialsSection />
    </>
  );
}
