/** Formata horas decimais em "7h30", "8h" ou "45min". */
export function fmtHoras(h: number) {
  const min = Math.round(h * 60);
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  if (hh && mm) return `${hh}h${String(mm).padStart(2, "0")}`;
  if (hh) return `${hh}h`;
  return `${mm}min`;
}
