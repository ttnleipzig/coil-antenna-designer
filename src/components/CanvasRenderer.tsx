import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import { useAntennaStore } from '../store/antennaStore';
import type { AntennaParams, AntennaCalcs } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const GRID_STEP = 20;

// Wheel-zoom tuning
/** px equivalent used when the browser reports scroll in line units (deltaMode=1) */
const DELTA_LINE_PX = 20;
/** Fraction of deltaY applied as zoom factor per wheel tick */
const ZOOM_SENSITIVITY = 0.001;
/** Maximum zoom-in factor applied per single wheel event (prevents overshoot) */
const MAX_ZOOM_FACTOR = 1.25;
/** Minimum zoom-out factor applied per single wheel event (prevents overshoot) */
const MIN_ZOOM_FACTOR = 0.8;

// ── Colour palettes (match original canvas colours exactly) ───────────────────

const MATERIAL_COLOUR = {
  copper:   { front: '#b45309', back: '#fcd34d' },
  aluminum: { front: '#475569', back: '#94a3b8' },
  silver:   { front: '#6b7280', back: '#e5e7eb' },
} as const;

// ── Geometry helper ───────────────────────────────────────────────────────────

interface CoilGeometry {
  turns: number;
  halfTurns: number;
  radiusPx: number;
  totalHeightPx: number;
  stepPx: number;
  cx: number;
  startY: number;
  strokeW: number;
}

function calcCoilGeometry(
  params: AntennaParams,
  calcs: AntennaCalcs,
  W: number,
  H: number,
): CoilGeometry {
  const turns = Math.max(1, Math.min(calcs.turns, 80));
  const halfTurns = Math.round(turns * 2);

  // Scale physical mm dimensions into pixels
  const diameterMm = Math.max(1, params.coilDiameter);
  const lengthMm = Math.max(1, calcs.coilLength);
  const diameterScale = (W * 0.56) / diameterMm;
  const lengthScale = (H * 0.75) / lengthMm;
  const mmToPx = Math.max(0.1, Math.min(diameterScale, lengthScale));

  const radiusPx = Math.max(8, (diameterMm / 2) * mmToPx);
  const totalHeightPx = Math.max(16, lengthMm * mmToPx);
  const stepPx = halfTurns > 1 ? totalHeightPx / halfTurns : totalHeightPx;
  const cx = W / 2;
  const startY = (H - totalHeightPx) / 2;
  const strokeW = Math.max(1, Math.min(params.wireThickness * 0.8, 6));

  return { turns, halfTurns, radiusPx, totalHeightPx, stepPx, cx, startY, strokeW };
}

// ── SVG path builders ─────────────────────────────────────────────────────────

/**
 * Returns an SVG arc path string for one half-turn of the coil.
 *
 * In canvas (Y-down) the original draws:
 *   isFront=true  → startAngle=π, endAngle=0 clockwise  → upper arc (front face)
 *   isFront=false → startAngle=0, endAngle=π clockwise  → lower arc (back face)
 *
 * In SVG (same Y-down convention):
 *   sweep=0 (counter-clockwise) → arc bulges upward   → front face ✓
 *   sweep=1 (clockwise)         → arc bulges downward → back face  ✓
 */
function halfEllipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  isFront: boolean,
): string {
  const x0 = cx - rx;
  const x1 = cx + rx;
  const sweep = isFront ? 0 : 1;
  return `M ${x0} ${cy} A ${rx} ${ry} 0 0 ${sweep} ${x1} ${cy}`;
}

/** Returns an SVG path string for a double-headed dimension arrow. */
function doubleArrowPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  const H = 5;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (x: number, y: number) => `${x.toFixed(2)} ${y.toFixed(2)}`;
  return [
    // Arrowhead at start
    `M ${p(x1 + H * Math.cos(a - Math.PI / 6), y1 + H * Math.sin(a - Math.PI / 6))}`,
    `L ${p(x1, y1)}`,
    `L ${p(x1 + H * Math.cos(a + Math.PI / 6), y1 + H * Math.sin(a + Math.PI / 6))}`,
    // Shaft
    `M ${p(x1, y1)} L ${p(x2, y2)}`,
    // Arrowhead at end
    `M ${p(x2 - H * Math.cos(a - Math.PI / 6), y2 - H * Math.sin(a - Math.PI / 6))}`,
    `L ${p(x2, y2)}`,
    `L ${p(x2 - H * Math.cos(a + Math.PI / 6), y2 - H * Math.sin(a + Math.PI / 6))}`,
  ].join(' ');
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * CanvasRenderer – SVG-based vector rendering of the helical coil.
 *
 * Replaces the original HTML-canvas implementation with an inline SVG that
 * supports infinite-quality export and interactive zoom / pan.
 *
 * Controls:
 *   • Mouse-wheel / trackpad → zoom centred on cursor
 *   • Left-drag              → pan
 *   • +/− buttons            → zoom centred on viewport centre
 *   • Reset                  → restore 1:1 view
 *   • Export SVG             → download coil-antenna.svg
 */
const CanvasRenderer: React.FC = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const params = useAntennaStore((s) => s.params);
  const calcs = useAntennaStore((s) => s.calcs);
  const darkMode = useAntennaStore((s) => s.darkMode);

  // Container size in px (updated by ResizeObserver)
  const [size, setSize] = useState({ w: 400, h: 300 });

  // View transform: scale + translation
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });

  // Drag state: ref drives the hot-path, state drives cursor style only
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const transformRef = useRef(transform);
  const panOrigin = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Keep transformRef in sync so pan handlers see the latest values
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  // Track container size via ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => {
      setSize({ w: container.clientWidth, h: container.clientHeight });
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, []);

  // Coil geometry, recomputed when params / calcs / size change
  const geo = useMemo(
    () => calcCoilGeometry(params, calcs, size.w, size.h),
    [params, calcs, size],
  );

  // ── Wheel zoom (non-passive so we can preventDefault) ─────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // Normalise across pixel (deltaMode=0), line (deltaMode=1), and page (deltaMode=2) modes
    const raw = e.deltaMode === 0 ? e.deltaY : e.deltaY * DELTA_LINE_PX;
    const factor = Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, 1 - raw * ZOOM_SENSITIVITY));
    setTransform((prev) => {
      const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * factor));
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        tx: mouseX - (mouseX - prev.tx) * ratio,
        ty: mouseY - (mouseY - prev.ty) * ratio,
      };
    });
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // ── Mouse pan ─────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    panOrigin.current = {
      x: e.clientX,
      y: e.clientY,
      tx: transformRef.current.tx,
      ty: transformRef.current.ty,
    };
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDraggingRef.current) return;
    const { x, y, tx, ty } = panOrigin.current;
    setTransform((prev) => ({
      ...prev,
      tx: tx + (e.clientX - x),
      ty: ty + (e.clientY - y),
    }));
  }, []);

  const stopDrag = useCallback(() => {
    isDraggingRef.current = false;
    setIsDragging(false);
  }, []);

  // ── Button zoom (centred on viewport midpoint) ────────────────────────────
  const zoom = useCallback(
    (factor: number) => {
      setTransform((prev) => {
        const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev.scale * factor));
        const ratio = nextScale / prev.scale;
        const vcx = size.w / 2;
        const vcy = size.h / 2;
        return {
          scale: nextScale,
          tx: vcx - (vcx - prev.tx) * ratio,
          ty: vcy - (vcy - prev.ty) * ratio,
        };
      });
    },
    [size],
  );

  const resetTransform = useCallback(() => {
    setTransform({ scale: 1, tx: 0, ty: 0 });
  }, []);

  // ── Export SVG ────────────────────────────────────────────────────────────
  const exportSVG = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: 'image/svg+xml',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'coil-antenna.svg';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Colours ───────────────────────────────────────────────────────────────
  const bgColor     = darkMode ? '#1e293b' : '#f8fafc';
  const gridColor   = darkMode ? '#1e3a5f' : '#e2e8f0';
  const axisColor   = darkMode ? '#475569' : '#94a3b8';
  const annotColor  = darkMode ? '#94a3b8' : '#64748b';
  const annotStroke = darkMode ? '#475569' : '#cbd5e1';

  // ── Memoised SVG content ──────────────────────────────────────────────────

  // Grid lines covering the fixed viewport area.
  // Rendered outside the zoom/pan transform so they always fill the screen
  // regardless of pan position or zoom level, avoiding any coverage gaps.
  const gridLines = useMemo(() => {
    const { w, h } = size;
    const els: React.ReactElement[] = [];
    for (let x = 0; x <= w; x += GRID_STEP) {
      els.push(<line key={`gx${x}`} x1={x} y1={0} x2={x} y2={h} />);
    }
    for (let y = 0; y <= h; y += GRID_STEP) {
      els.push(<line key={`gy${y}`} x1={0} y1={y} x2={w} y2={y} />);
    }
    return els;
  }, [size]);

  // Coil half-turn arcs
  const coilArcs = useMemo(() => {
    const { halfTurns, radiusPx, stepPx, cx, startY, strokeW } = geo;
    const mc = MATERIAL_COLOUR[params.material];
    return Array.from({ length: halfTurns }, (_, i) => {
      const cy = startY + i * stepPx + stepPx / 2;
      const ry = stepPx * 0.4;
      const isFront = i % 2 === 0;
      return (
        <path
          key={`arc${i}`}
          d={halfEllipsePath(cx, cy, radiusPx, ry, isFront)}
          stroke={isFront ? mc.front : mc.back}
          strokeWidth={strokeW}
          strokeLinecap="round"
          opacity={isFront ? 1 : 0.45}
          fill="none"
        />
      );
    });
  }, [geo, params.material]);

  // Turn-count labels
  const turnLabels = useMemo(() => {
    const { turns, radiusPx, stepPx, cx, startY } = geo;
    const lColor = darkMode ? '#94a3b8' : '#64748b';
    const labelStep = Math.max(1, Math.floor(turns / 5));
    const els: React.ReactElement[] = [];
    for (let t = 1; t <= Math.floor(turns); t += labelStep) {
      const yLbl = startY + (t * 2 - 1) * stepPx;
      els.push(
        <text
          key={`lbl${t}`}
          x={cx - radiusPx - 6}
          y={yLbl}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize={10}
          fontFamily="monospace"
          fill={lColor}
        >
          {t}×
        </text>,
      );
    }
    return els;
  }, [geo, darkMode]);

  // Annotation geometry (cheap to recompute every render)
  const { radiusPx, totalHeightPx, cx, startY } = geo;
  const arrowY = startY - 16;
  const arrowX = cx + radiusPx + 14;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          Coil Visualization
        </h2>
        <div className="flex items-center gap-1.5">
          {/* Zoom percentage */}
          <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums w-10 text-right">
            {Math.round(transform.scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoom(1.25)}
            className="text-xs w-6 h-6 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoom(0.8)}
            className="text-xs w-6 h-6 flex items-center justify-center rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={resetTransform}
            className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={exportSVG}
            className="text-xs px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
          >
            Export SVG
          </button>
        </div>
      </div>

      {/* ── SVG viewport ─────────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative flex-1 min-h-0 overflow-hidden">
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="absolute inset-0 select-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
        >
          {/* Background */}
          <rect width={size.w} height={size.h} fill={bgColor} />

          {/* Grid – fixed to the viewport so it always covers the full area
              regardless of zoom level or pan position */}
          <g stroke={gridColor} strokeWidth={0.5} fill="none">
            {gridLines}
          </g>

          {/* ── Zoomable / pannable group ─────────────────────────────── */}
          <g transform={`translate(${transform.tx},${transform.ty}) scale(${transform.scale})`}>

            {/* Coil axis */}
            <line
              x1={cx}
              y1={startY - 10}
              x2={cx}
              y2={startY + totalHeightPx + 10}
              stroke={axisColor}
              strokeWidth={1}
              strokeDasharray="4 4"
            />

            {/* Coil arcs */}
            {coilArcs}

            {/* Turn-count labels */}
            {turnLabels}

            {/* Diameter annotation */}
            <path
              d={doubleArrowPath(cx - radiusPx, arrowY, cx + radiusPx, arrowY)}
              stroke={annotStroke}
              strokeWidth={0.8}
              fill="none"
            />
            <text
              x={cx}
              y={arrowY - 4}
              textAnchor="middle"
              fontSize={9}
              fontFamily="monospace"
              fill={annotColor}
            >
              ⌀ {params.coilDiameter.toFixed(1)} mm
            </text>

            {/* Length annotation */}
            <path
              d={doubleArrowPath(arrowX, startY, arrowX, startY + totalHeightPx)}
              stroke={annotStroke}
              strokeWidth={0.8}
              fill="none"
            />
            <text
              x={arrowX + 4}
              y={startY + totalHeightPx / 2}
              textAnchor="start"
              dominantBaseline="middle"
              fontSize={9}
              fontFamily="monospace"
              fill={annotColor}
            >
              {calcs.coilLength.toFixed(1)} mm
            </text>

          </g>
        </svg>
      </div>

    </div>
  );
};

export default CanvasRenderer;
