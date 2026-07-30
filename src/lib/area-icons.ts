import {
  Bed,
  Bike,
  BookOpen,
  Briefcase,
  Car,
  Church,
  Coffee,
  Dumbbell,
  HeartPulse,
  Home,
  Music,
  PiggyBank,
  Sparkle,
  Sun,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { normalize } from "./areas";

const MAPA: { teste: RegExp; icone: LucideIcon }[] = [
  { teste: /dorm|sono|sleep|noite/, icone: Bed },
  { teste: /trabalh|escritorio|job|projeto/, icone: Briefcase },
  { teste: /academ|esporte|treino|exerc/, icone: Dumbbell },
  { teste: /saude|medic/, icone: HeartPulse },
  { teste: /famil/, icone: Users },
  { teste: /amig/, icone: Users },
  { teste: /estud|leitura|ler|curso/, icone: BookOpen },
  { teste: /fe$|igreja|deus|oracao|espirit/, icone: Church },
  { teste: /lazer|descanso|hobby/, icone: Music },
  { teste: /financ|dinheiro/, icone: PiggyBank },
  { teste: /casa|domestic|limpeza/, icone: Home },
  { teste: /desloc|transporte|carro|trajeto/, icone: Car },
  { teste: /aliment|refeic|cafe|almoco|jantar|lanche/, icone: UtensilsCrossed },
  { teste: /pausa|intervalo|respir/, icone: Coffee },
  { teste: /manha|rotina/, icone: Sun },
  { teste: /bike|pedal|corrida/, icone: Bike },
];

/** Ícone que combina com o nome da área (ou do bloco), com fallback neutro. */
export function areaIcon(...nomes: (string | null | undefined)[]): LucideIcon {
  for (const nome of nomes) {
    if (!nome) continue;
    const n = normalize(nome);
    const achado = MAPA.find((m) => m.teste.test(n));
    if (achado) return achado.icone;
  }
  return Sparkle;
}

/** Fundo suave para o badge do ícone a partir da cor da área. */
export function areaTint(color?: string | null) {
  return `color-mix(in oklab, ${color ?? "var(--muted)"} 26%, var(--card))`;
}