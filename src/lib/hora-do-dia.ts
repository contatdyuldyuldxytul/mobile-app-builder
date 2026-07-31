/**
 * Ilustração do topo da tela Hoje: muda conforme a hora do relógio.
 * As artes vivem no CDN (ponteiros .asset.json em src/assets/horas).
 */
import { useEffect, useState } from "react";
import a5AM from "@/assets/horas/5AM.asset.json";
import a7AM from "@/assets/horas/7AM.asset.json";
import a9AM from "@/assets/horas/9AM.asset.json";
import a11AM from "@/assets/horas/11AM.asset.json";
import a1PM from "@/assets/horas/1PM.asset.json";
import a5PM from "@/assets/horas/5PM.asset.json";
import a7PM from "@/assets/horas/7PM.asset.json";
import a9PM from "@/assets/horas/9PM.asset.json";
import a11PM from "@/assets/horas/11PM.asset.json";

type Faixa = { desde: number; url: string; alt: string };

/** Ordenadas por hora inicial; antes das 5h volta para a arte da madrugada. */
const FAIXAS: Faixa[] = [
  { desde: 5, url: a5AM.url, alt: "Montanhas ao luar, antes do amanhecer" },
  { desde: 7, url: a7AM.url, alt: "Sol nascendo atrás das montanhas" },
  { desde: 9, url: a9AM.url, alt: "Manhã clara sobre as montanhas" },
  { desde: 11, url: a11AM.url, alt: "Sol alto sobre as montanhas" },
  { desde: 13, url: a1PM.url, alt: "Tarde ensolarada sobre as montanhas" },
  { desde: 17, url: a5PM.url, alt: "Fim de tarde alaranjado nas montanhas" },
  { desde: 19, url: a7PM.url, alt: "Pôr do sol atrás das montanhas" },
  { desde: 21, url: a9PM.url, alt: "Noite com lua sobre as montanhas" },
  { desde: 23, url: a11PM.url, alt: "Madrugada com lua sobre as montanhas" },
];

export function ilustracaoDaHora(hora: number): Faixa {
  if (hora < FAIXAS[0].desde) return FAIXAS[FAIXAS.length - 1];
  let escolhida = FAIXAS[0];
  for (const f of FAIXAS) if (hora >= f.desde) escolhida = f;
  return escolhida;
}

/** Reavalia a cada minuto — o dia passa sem precisar recarregar a tela. */
export function useIlustracaoDoDia() {
  const [hora, setHora] = useState(() => new Date().getHours());
  useEffect(() => {
    const id = setInterval(() => setHora(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);
  return ilustracaoDaHora(hora);
}