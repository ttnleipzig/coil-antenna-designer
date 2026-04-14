import React, { useRef, useEffect, useCallback } from 'react';
import { useAntennaStore } from '../store/antennaStore';

/**
 * CanvasRenderer – draws a 2-D projection of the helical coil.
 *
 * The coil is rendered as a series of elliptical arcs that simulate the
 * perspective of a helix viewed slightly from above.  Each arc represents
 * one half-turn, alternating between the "front" (darker) and "back"
 * (lighter) of the coil.
 */
const CanvasRenderer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useAntennaStore((s) => s.params);
  const calcs = useAntennaStore((s) => s.calcs);
  const darkMode = useAntennaStore((s) => s.darkMode);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // ── Background ──────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = darkMode ? '#1e293b' : '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // ── Grid ────────────────────────────────────────────────────
    drawGrid(ctx, W, H, darkMode);

    // ── Coil geometry ────────────────────────────────────────────
    const turns = Math.max(1, Math.min(calcs.turns, 80));
    const halfTurns = Math.round(turns * 2);

    // Pixel radius of the coil (scale to fit canvas)
    const radiusPx = Math.min(W * 0.28, 80);

    // Total axial height in pixels
    const totalHeightPx = Math.min(H * 0.75, halfTurns * 6);
    const stepPx = halfTurns > 1 ? totalHeightPx / halfTurns : totalHeightPx;

    const cx = W / 2;
    const startY = (H - totalHeightPx) / 2;

    // ── Axis line ───────────────────────────────────────────────
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = darkMode ? '#475569' : '#94a3b8';
    ctx.lineWidth = 1;
    ctx.moveTo(cx, startY - 10);
    ctx.lineTo(cx, startY + totalHeightPx + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Wire thickness → stroke width ───────────────────────────
    const strokeW = Math.max(1, Math.min(params.wireThickness * 0.8, 6));

    // ── Material colour ──────────────────────────────────────────
    const materialColour = {
      copper: { front: '#b45309', back: '#fcd34d' },
      aluminum: { front: '#475569', back: '#94a3b8' },
      silver: { front: '#6b7280', back: '#e5e7eb' },
    }[params.material];

    // ── Draw half-turn arcs ──────────────────────────────────────
    for (let i = 0; i < halfTurns; i++) {
      const y = startY + i * stepPx;
      const isFront = i % 2 === 0;
      const alpha = isFront ? 1 : 0.45;

      ctx.beginPath();
      ctx.ellipse(
        cx,
        y + stepPx / 2,
        radiusPx,
        stepPx * 0.4,
        0,
        isFront ? Math.PI : 0,
        isFront ? 0 : Math.PI,
      );
      ctx.strokeStyle = isFront ? materialColour.front : materialColour.back;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ── Turn-count labels ────────────────────────────────────────
    ctx.font = '10px monospace';
    ctx.fillStyle = darkMode ? '#94a3b8' : '#64748b';
    ctx.textAlign = 'right';
    const labelStep = Math.max(1, Math.floor(turns / 5));
    for (let t = 1; t <= Math.floor(turns); t += labelStep) {
      const yLbl = startY + (t * 2 - 1) * stepPx;
      ctx.fillText(`${t}×`, cx - radiusPx - 6, yLbl);
    }

    // ── Dimension annotation ─────────────────────────────────────
    drawAnnotations(ctx, W, H, cx, startY, totalHeightPx, radiusPx, calcs, darkMode);
  }, [params, calcs, darkMode]);

  // Re-draw whenever dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // Resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, [draw]);

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'coil-antenna.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          Coil Visualization
        </h2>
        <button
          onClick={exportPNG}
          className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
        >
          Export PNG
        </button>
      </div>
      <div ref={containerRef} className="relative flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
        />
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  dark: boolean,
) {
  ctx.strokeStyle = dark ? '#1e3a5f' : '#e2e8f0';
  ctx.lineWidth = 0.5;
  const step = 20;
  for (let x = 0; x <= W; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  _W: number,
  _H: number,
  cx: number,
  startY: number,
  totalH: number,
  radiusPx: number,
  calcs: { coilLength: number; coilDiameter?: number },
  dark: boolean,
) {
  ctx.font = '9px monospace';
  ctx.fillStyle = dark ? '#94a3b8' : '#64748b';
  ctx.strokeStyle = dark ? '#475569' : '#cbd5e1';
  ctx.lineWidth = 0.8;
  ctx.textAlign = 'left';

  // Diameter arrow at the top
  const arrowY = startY - 16;
  arrow(ctx, cx - radiusPx, arrowY, cx + radiusPx, arrowY);
  ctx.textAlign = 'center';
  ctx.fillText(`⌀ ${(radiusPx * 2).toFixed(0)} px`, cx, arrowY - 4);

  // Length arrow on the right
  const arrowX = cx + radiusPx + 14;
  arrow(ctx, arrowX, startY, arrowX, startY + totalH);
  ctx.textAlign = 'left';
  ctx.fillText(`${calcs.coilLength.toFixed(0)} mm`, arrowX + 4, startY + totalH / 2);
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const headLen = 5;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  // arrowhead
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 6),
    y2 - headLen * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 6),
    y2 - headLen * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

export default CanvasRenderer;
