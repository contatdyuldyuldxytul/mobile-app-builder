import { useEffect, useRef, useState } from "react";
import { VIDEO, type GuardiaoAnimado } from "@/lib/guardiao-animacao";
import { cn } from "@/lib/utils";

/**
 * Compõe o MP4 de matte empilhado num canvas: metade de cima em RGB,
 * metade de baixo como canal alfa. O vídeo em si fica oculto.
 */
export function GuardiaoOverlay({
  id,
  comSom,
  onFim,
}: {
  id: GuardiaoAnimado;
  comSom: boolean;
  onFim: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [saindo, setSaindo] = useState(false);
  const fechado = useRef(false);

  function fechar() {
    if (fechado.current) return;
    fechado.current = true;
    setSaindo(true);
    window.setTimeout(onFim, 420);
  }

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d", { willReadFrequently: true });
    const ctx = canvas.getContext("2d");
    let raf = 0;

    function desenhar() {
      raf = requestAnimationFrame(desenhar);
      if (!video || !canvas || !ctx || !offCtx) return;
      const w = video.videoWidth;
      const alturaTotal = video.videoHeight;
      if (!w || !alturaTotal) return;
      const h = Math.floor(alturaTotal / 2);

      if (off.width !== w || off.height !== alturaTotal) {
        off.width = w;
        off.height = alturaTotal;
        canvas.width = w;
        canvas.height = h;
      }

      offCtx.drawImage(video, 0, 0, w, alturaTotal);
      const cor = offCtx.getImageData(0, 0, w, h);
      const mascara = offCtx.getImageData(0, h, w, h);
      const px = cor.data;
      const mx = mascara.data;
      for (let i = 0; i < px.length; i += 4) {
        // Luminância da máscara: branco = opaco, preto = transparente.
        px[i + 3] = (mx[i] * 0.299 + mx[i + 1] * 0.587 + mx[i + 2] * 0.114) | 0;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.putImageData(cor, 0, 0);
    }

    async function tocar() {
      if (!video) return;
      video.src = VIDEO[id];
      video.load();
      video.muted = !comSom;
      try {
        await video.play();
      } catch {
        // O navegador recusou o áudio: muta e tenta de novo — a animação
        // nunca pode deixar de aparecer por causa do som.
        video.muted = true;
        try {
          await video.play();
        } catch {
          fechar();
        }
      }
    }

    video.addEventListener("ended", fechar);
    video.addEventListener("error", fechar);
    raf = requestAnimationFrame(desenhar);
    void tocar();

    // Rede de segurança: nunca ficar preso na tela.
    const limite = window.setTimeout(fechar, 20000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(limite);
      video.removeEventListener("ended", fechar);
      video.removeEventListener("error", fechar);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, comSom]);

  return (
    <div
      role="presentation"
      onPointerDown={fechar}
      className={cn(
        "fixed inset-0 z-50 grid place-items-center bg-background/35 backdrop-blur-md transition-opacity duration-500",
        saindo ? "opacity-0" : "opacity-100 animate-fade-in",
      )}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className={cn(
          "max-h-[70dvh] max-w-[80vw] transition-all duration-500",
          saindo ? "scale-95 opacity-0" : "scale-100 opacity-100",
        )}
      />
      <video ref={videoRef} playsInline preload="none" className="hidden" />
    </div>
  );
}
