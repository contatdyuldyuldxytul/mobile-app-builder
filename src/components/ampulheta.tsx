import { Personagem } from "@/components/personagem";
import type { EstadoGuardiao } from "@/lib/guardioes";
import { cn } from "@/lib/utils";

function estadoDaAreia(areia: number): EstadoGuardiao {
  if (areia < 0.2) return "adormecido";
  if (areia < 0.5) return "desperto";
  if (areia < 0.8) return "firme";
  return "radiante";
}

/**
 * A Ampulheta é a protagonista: a areia é o orçamento da semana honrado.
 * Ela vira a cada semana nova — recomeço embutido, sem texto de culpa.
 */
export function Ampulheta({
  areia,
  frase,
  virando = false,
  tamanho = "lg",
  className,
}: {
  areia: number;
  frase?: string;
  virando?: boolean;
  tamanho?: "md" | "lg" | "xl";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4", className)}>
      <span
        className={cn(
          "shrink-0 transition-transform duration-[1400ms] ease-in-out",
          virando && "rotate-180",
        )}
      >
        <Personagem
          id="ampulheta"
          nome="Ampulheta"
          estado={estadoDaAreia(areia)}
          tamanho={tamanho}
        />
      </span>
      {frase && (
        <div className="min-w-0">
          <p className="text-lg leading-snug">{frase}</p>
          {virando && (
            <p className="mt-1 text-sm text-muted-foreground">A ampulheta virou. Semana nova.</p>
          )}
        </div>
      )}
    </div>
  );
}
