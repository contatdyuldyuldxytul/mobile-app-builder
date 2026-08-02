import { useEffect, useRef, useState } from "react";
import type { GuardiaoAnim } from "@/lib/guardiao-trigger";
import { useSettings } from "@/lib/data";
import { cn } from "@/lib/utils";

import ampulhetaWebp from "@/assets/guardioes/ampulheta.webp.asset.json";
import caderno from "@/assets/guardioes/caderno.webp.asset.json";
import check from "@/assets/guardioes/check.webp.asset.json";
import folha from "@/assets/guardioes/folha.webp.asset.json";
import montanha from "@/assets/guardioes/montanha.webp.asset.json";
import nuvem from "@/assets/guardioes/nuvem.webp.asset.json";
import sol from "@/assets/guardioes/sol.webp.asset.json";
import ampulhetaSom from "@/assets/guardioes/ampulheta.mp4.asset.json";
import cadernoSom from "@/assets/guardioes/caderno.mp4.asset.json";
import checkSom from "@/assets/guardioes/check.mp4.asset.json";
import folhaSom from "@/assets/guardioes/folha.mp4.asset.json";
import montanhaSom from "@/assets/guardioes/montanha.mp4.asset.json";
import nuvemSom from "@/assets/guardioes/nuvem.mp4.asset.json";
import solSom from "@/assets/guardioes/sol.mp4.asset.json";

const ANIMACAO: Record<GuardiaoAnim, string> = {
  ampulheta: ampulhetaWebp.url,
  caderno: caderno.url,
  check: check.url,
  folha: folha.url,
  montanha: montanha.url,
  nuvem: nuvem.url,
  sol: sol.url,
};

const SOM: Record<GuardiaoAnim, string> = {
  ampulheta: ampulhetaSom.url,
  caderno: cadernoSom.url,
  check: checkSom.url,
  folha: folhaSom.url,
  montanha: montanhaSom.url,
  nuvem: nuvemSom.url,
  sol: solSom.url,
};

/** Tempo em cena quando o som não estiver disponível para marcar o fim. */
const DURACAO_MS = 5200;
const SAIDA_MS = 500;

/**
 * O guardião aparece na frente da tela: desfoque atrás, personagem centralizado,
 * sem card e sem moldura. Toca uma vez, some sozinho e sai a qualquer toque.
 */
export function GuardiaoOverlay({
  guardiao,
  onClose,
}: {
  guardiao: GuardiaoAnim | null;
  onClose: () => void;
}) {
  const { data: settings } = useSettings();
  const comSom = settings?.guardian_sounds_enabled ?? true;
  const [saindo, setSaindo] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!guardiao) return;
    setSaindo(false);

    let fim: ReturnType<typeof setTimeout>;
    const encerrar = () => {
      setSaindo(true);
      fim = setTimeout(onClose, SAIDA_MS);
    };
    const timer = setTimeout(encerrar, DURACAO_MS);

    // O som é opcional: se o navegador bloquear, a animação segue em silêncio.
    if (comSom) {
      const audio = new Audio(SOM[guardiao]);
      audioRef.current = audio;
      audio.play().catch(() => {});
    }

    return () => {
      clearTimeout(timer);
      clearTimeout(fim);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [guardiao, comSom, onClose]);

  if (!guardiao) return null;

  return (
    <div
      role="presentation"
      onPointerDown={onClose}
      className={cn(
        "fixed inset-0 z-[70] grid place-items-center bg-foreground/25 backdrop-blur-md transition-opacity duration-500",
        saindo ? "opacity-0" : "opacity-100 animate-fade-in",
      )}
    >
      <img
        src={ANIMACAO[guardiao]}
        alt=""
        aria-hidden
        draggable={false}
        className={cn(
          "max-h-[60vh] w-[70vw] max-w-sm object-contain transition-all duration-500",
          saindo ? "scale-95 opacity-0" : "scale-100 opacity-100 animate-scale-in",
        )}
      />
    </div>
  );
}
