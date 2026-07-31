import { ARTE, type EstadoGuardiao, type PersonagemId } from "@/lib/guardioes";
import { cn } from "@/lib/utils";

/** Os quatro estados são filtros sobre a mesma arte — não há um arquivo por estado. */
const FILTRO: Record<EstadoGuardiao, string> = {
  adormecido: "grayscale(0.85) saturate(0.4) brightness(1.06) opacity(0.45)",
  desperto: "grayscale(0.45) saturate(0.8) opacity(0.75)",
  firme: "grayscale(0) saturate(1) opacity(1)",
  radiante: "grayscale(0) saturate(1.12) brightness(1.03) opacity(1)",
};

const TAMANHO = {
  sm: "h-12 w-12",
  md: "h-20 w-20",
  lg: "h-32 w-32",
  xl: "h-44 w-44",
} as const;

/**
 * Personagem-guardião. Ele reflete, não cobra: só arte e estado,
 * sem número, sem barra, sem contagem.
 */
export function Personagem({
  id,
  estado = "firme",
  sobrecarregado = false,
  tamanho = "md",
  nome,
  className,
}: {
  id: PersonagemId;
  estado?: EstadoGuardiao;
  sobrecarregado?: boolean;
  tamanho?: keyof typeof TAMANHO;
  nome?: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-grid place-items-center", TAMANHO[tamanho], className)}>
      {estado === "radiante" && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-secondary/20 blur-xl transition-opacity duration-700"
        />
      )}
      <img
        src={ARTE[id]}
        alt={nome ? `${nome} — ${estado}` : ""}
        aria-hidden={!nome}
        loading="lazy"
        draggable={false}
        className={cn(
          "relative h-full w-full object-contain transition-[filter,opacity,transform] duration-700 ease-out",
          sobrecarregado && "-rotate-3",
        )}
        style={{ filter: FILTRO[estado] }}
      />
    </span>
  );
}
