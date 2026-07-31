import { useIlustracaoDoDia } from "@/lib/hora-do-dia";
import type { Quote } from "@/lib/quotes";

/** Frase do dia à esquerda, ilustração do horário à direita. */
export function HeroHoje({ frase }: { frase: Quote }) {
  const arte = useIlustracaoDoDia();
  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card">
      <img
        src={arte.url}
        alt={arte.alt}
        className="pointer-events-none absolute bottom-0 right-0 h-full w-40 select-none object-contain object-bottom opacity-95 sm:w-56"
      />
      <div className="relative max-w-[62%] p-5 sm:max-w-[65%]">
        <p className="text-lg leading-relaxed">“{frase.text}”</p>
        <p className="mt-2 text-sm text-muted-foreground">— {frase.author}</p>
      </div>
    </section>
  );
}