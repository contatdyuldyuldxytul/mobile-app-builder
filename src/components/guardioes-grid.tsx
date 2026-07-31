import { Personagem } from "@/components/personagem";
import type { Guardiao } from "@/lib/guardioes";
import { cn } from "@/lib/utils";

const RECADO: Record<Guardiao["estado"], string> = {
  adormecido: "adormecido",
  desperto: "desperto",
  firme: "firme",
  radiante: "radiante",
};

/** O ecossistema inteiro — usado na revisão semanal. */
export function GuardioesGrid({
  guardioes,
  className,
}: {
  guardioes: Guardiao[];
  className?: string;
}) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", className)}>
      {guardioes.map((g) => (
        <li
          key={g.id}
          className={cn(
            "flex flex-col items-center gap-2 rounded-2xl border bg-card p-3 text-center transition-colors duration-700",
            g.sobrecarregado && "border-primary/40 bg-primary/5",
            g.estado === "adormecido" && "bg-muted/40",
          )}
        >
          <Personagem id={g.id} nome={g.nome} estado={g.estado} sobrecarregado={g.sobrecarregado} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{g.nome}</p>
            <p className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
              {g.sobrecarregado ? "sobrecarregado" : RECADO[g.estado]}
            </p>
          </div>
          <p className="text-xs leading-snug text-muted-foreground">{g.frase}</p>
        </li>
      ))}
    </ul>
  );
}
