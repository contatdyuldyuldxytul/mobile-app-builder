import confetti from "canvas-confetti";

/** Confete curto + vibração — feedback de "consegui". */
export function celebrate(intensity: "small" | "big" = "small") {
  const big = intensity === "big";
  confetti({
    particleCount: big ? 140 : 45,
    spread: big ? 100 : 60,
    startVelocity: big ? 45 : 30,
    scalar: big ? 1 : 0.8,
    ticks: big ? 220 : 120,
    origin: { y: big ? 0.5 : 0.7 },
    disableForReducedMotion: true,
  });
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(big ? [20, 40, 20] : 15);
  }
}
