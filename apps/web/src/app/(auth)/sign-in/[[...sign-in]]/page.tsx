import { SignIn } from "@clerk/nextjs";

// Catch-all opcional: Clerk necesita este patrón de ruta para su routing
// interno multi-paso (verificación, reset de password, etc.) cuando se usa
// path-based routing en vez de modal.
export default function Page() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <SignIn />
    </div>
  );
}
