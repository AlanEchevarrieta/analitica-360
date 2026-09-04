import { Shell } from './Shell'

export function SetupPage() {
  return (
    <Shell>
      <h1 className="mb-3 text-2xl font-bold text-[#3E2716]">Falta conectar Supabase</h1>
      <ol className="list-decimal space-y-3 pl-5 text-left text-sm leading-relaxed text-[#4a3d30]">
        <li>
          Entrá a supabase.com, creá una cuenta y un proyecto (región South America si aparece).
        </li>
        <li>
          En SQL Editor pegá y ejecutá el archivo <code className="text-xs">supabase/001_auth_empresa.sql</code>.
        </li>
        <li>
          En Authentication → Providers → Email, desactivá Confirm email para probar más fácil.
        </li>
        <li>
          En Project Settings → API copiá Project URL y anon public key.
        </li>
        <li>
          En la carpeta Analitica creá un archivo <code className="text-xs">.env.local</code> con esas dos
          claves (hay un ejemplo en <code className="text-xs">.env.example</code>).
        </li>
        <li>Avisame y reiniciamos la app.</li>
      </ol>
    </Shell>
  )
}
