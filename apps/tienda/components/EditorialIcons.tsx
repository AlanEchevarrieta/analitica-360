import React from "react";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  strokeWidth?: number;
}

/**
 * Colección de vectores editoriales de alta gama diseñados a medida
 * con trazos refinados acordes a la tipografía Cormorant Garamond.
 */

// Copa de vino Bordeaux con reflejo líquido y tallo estilizado
export function WineChaliceIcon({ size = 24, strokeWidth = 1.35, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M7 3h10c0 4.5-2.2 8-5 8s-5-3.5-5-8Z" />
      <path d="M12 11v8" />
      <path d="M8 21h8" />
      <path d="M7.5 6.5c1.5 1 3.2 1.5 4.5 1.5s3-.5 4.5-1.5" strokeOpacity="0.4" />
    </svg>
  );
}

// Cordillera Andina con curvas topográficas y picos escalonados
export function AndesMountainIcon({ size = 24, strokeWidth = 1.35, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="m2 20 7.5-13 4 7 3-5 5.5 11H2Z" />
      <path d="M6.5 12.5 9.5 15l2-1.5" strokeOpacity="0.5" />
      <path d="m15 11 1.5 2 2-1" strokeOpacity="0.5" />
      <path d="M9.5 7v13" strokeDasharray="1 3" strokeOpacity="0.3" />
    </svg>
  );
}

// Rosa de los Vientos / Brújula astronómica
export function CelestialCompassIcon({ size = 24, strokeWidth = 1.35, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="9" strokeOpacity="0.4" />
      <circle cx="12" cy="12" r="2" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="m12 6 2 4.5 4.5 1.5-4.5 1.5-2 4.5-2-4.5-4.5-1.5 4.5-1.5L12 6Z" fill="currentColor" fillOpacity="0.12" />
    </svg>
  );
}

// Bolsa boutique de cuero / lino artesanal
export function LuxuryBoutiqueBagIcon({ size = 24, strokeWidth = 1.35, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M5 8.5h14l-1.2 11.5H6.2L5 8.5Z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
      <circle cx="9" cy="10" r="0.75" fill="currentColor" />
      <circle cx="15" cy="10" r="0.75" fill="currentColor" />
    </svg>
  );
}

// Lupa óptica de joyero con doble aro y mango estilizado
export function JewelerLoupeIcon({ size = 24, strokeWidth = 1.35, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="11" cy="11" r="7" />
      <circle cx="11" cy="11" r="5" strokeOpacity="0.3" strokeDasharray="2 2" />
      <path d="m16 16 5 5" />
    </svg>
  );
}

// Escudo con corona de laurel y sello de garantía
export function HeritageShieldIcon({ size = 24, strokeWidth = 1.35, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <path d="M12 3s6 2.5 6 8.5c0 6-6 9.5-6 9.5s-6-3.5-6-9.5C6 5.5 12 3 12 3Z" />
      <path d="m9.5 12 1.8 1.8 3.5-3.6" />
    </svg>
  );
}

// Destello / Sol de Mendoza
export function AndeanSunIcon({ size = 24, strokeWidth = 1.35, className, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.1" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
    </svg>
  );
}
