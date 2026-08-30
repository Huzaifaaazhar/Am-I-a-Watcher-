"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "01ΔΞΦΨΩABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COLORS = ["#D4AF37", "#FF9900", "#2FBE6C"];

/**
 * TVA malfunction overlay: falling glyphs across the top of the canvas,
 * shown only while a deviation is being processed. Plain canvas 2D - cheap
 * enough to redraw every frame and never competes with the WebGL scene for
 * the GPU context.
 */
export default function MatrixRain({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const fontSize = 13;
    const columns = Math.ceil(canvas.width / fontSize);
    const drops = new Array(columns).fill(0).map(() => Math.random() * -40);

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.14)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < columns; i++) {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        ctx.fillStyle = COLORS[Math.floor(Math.random() * COLORS.length)];
        ctx.fillText(glyph, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height * 0.55 && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={ref}
      // The trail is drawn by fading the canvas to black each frame, which
      // left a hard horizontal seam where the element ended. Masking the
      // bottom edge lets the rain dissolve into the scene instead.
      style={{
        maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)",
      }}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[46%] w-full opacity-70"
    />
  );
}
