// ---------------------------------
// фигуры «в рамке»: тела и графики
// ---------------------------------
// хранятся как прямоугольник (cx, cy, w, h, angle) — хэндлы, ресайз и поворот
// берутся из rect.js, здесь только отрисовка внутри рамки

import { HANDLE_RADIUS, getRotateHandle } from "./utils.js";
import { getRectHandles } from "./rect.js";

export const SOLIDS = [
    "cube",
    "prism3",
    "prism6",
    "pyramid3",
    "pyramid4",
    "pyramid6",
];
export const GRAPHS = ["parabola", "hyperbola", "sine"];
export const BOXED = [...SOLIDS, ...GRAPHS];

export function isBoxed(type) {
    return BOXED.includes(type);
}

// ---------------------------------
// draw
// ---------------------------------

export function drawBoxedCreate(ctx, type, start, end) {
    const w = Math.max(20, Math.abs(end.x - start.x));
    const h = Math.max(20, Math.abs(end.y - start.y));

    ctx.save();
    ctx.translate((start.x + end.x) / 2, (start.y + end.y) / 2);
    drawBoxedShape(ctx, type, w, h);
    ctx.restore();
}

export function drawBoxedEdit(ctx, g, final = false) {
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.angle);

    // рамка, за углы которой тянем (только при редактировании)
    if (!final) {
        ctx.save();
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-g.w / 2, -g.h / 2, g.w, g.h);
        ctx.restore();
    }

    drawBoxedShape(ctx, g.type, g.w, g.h);
    ctx.restore();

    if (!final) {
        ctx.fillStyle = "#4aa3ff";
        for (const h of getRectHandles(g)) {
            ctx.beginPath();
            ctx.arc(h.x, h.y, HANDLE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }

        const r = getRotateHandle(g);
        ctx.fillStyle = "gold";
        ctx.beginPath();
        ctx.arc(r.x, r.y, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }
}

// фигура в локальных координатах: рамка [-w/2, w/2] × [-h/2, h/2]
function drawBoxedShape(ctx, type, w, h) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (type) {
        case "cube":
            return drawCube(ctx, w, h);
        case "prism3":
            return drawPrism(ctx, w, h, 3, Math.PI / 2);
        case "prism6":
            return drawPrism(ctx, w, h, 6, HEX_PHASE);
        case "pyramid3":
            return drawPyramid(ctx, w, h, 3, Math.PI / 2);
        case "pyramid4":
            return drawPyramid4(ctx, w, h);
        case "pyramid6":
            return drawPyramid(ctx, w, h, 6, HEX_PHASE);
        case "parabola":
            return drawCurve(ctx, parabolaPoints(w, h));
        case "hyperbola":
            hyperbolaBranches(w, h).forEach((b) => drawCurve(ctx, b));
            return;
        case "sine":
            return drawCurve(ctx, sinePoints(w, h));
    }
}

// ---------------------------------
// тела
// ---------------------------------

const DEPTH = 0.3; // доля рамки на «глубину» куба
const FLATTEN = 0.35; // сплющивание основания (взгляд сверху под углом)
// шестиугольник чуть повёрнут: иначе передние и задние вертикальные рёбра совпадают
const HEX_PHASE = Math.PI / 12;

// куб / параллелепипед в кабинетной проекции: передняя грань слева снизу,
// невидимые рёбра — из заднего левого нижнего угла
function drawCube(ctx, w, h) {
    const ox = w * DEPTH;
    const oy = h * DEPTH;
    const l = -w / 2;
    const r = w / 2 - ox;
    const t = -h / 2 + oy;
    const b = h / 2;

    const f = { tl: [l, t], tr: [r, t], br: [r, b], bl: [l, b] };
    const k = {};
    for (const key in f) k[key] = [f[key][0] + ox, f[key][1] - oy];

    edges(ctx, false, [
        [f.tl, f.tr],
        [f.tr, f.br],
        [f.br, f.bl],
        [f.bl, f.tl],
        [k.tl, k.tr],
        [k.tr, k.br],
        [f.tl, k.tl],
        [f.tr, k.tr],
        [f.br, k.br],
    ]);
    edges(ctx, true, [
        [k.bl, k.tl],
        [k.bl, k.br],
        [k.bl, f.bl],
    ]);
}

// правильный n-угольник в основании, вписанный в рамку по ширине;
// возвращает вершины (смещение основания от его верхней точки) и глубину основания
function basePolygon(w, h, n, phase, maxDepth) {
    const unit = [];
    for (let i = 0; i < n; i++) {
        const a = phase + (i * 2 * Math.PI) / n;
        unit.push({ x: Math.cos(a), y: Math.sin(a) });
    }
    const xs = unit.map((p) => p.x);
    const ys = unit.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX;
    const spanY = Math.max(...ys) - minY;

    const sx = w / spanX;
    const sy = Math.min(sx * FLATTEN, maxDepth / spanY);

    // ребро основания «сзади», если его середина дальше от зрителя (y < 0)
    const back = unit.map((p, i) => (p.y + unit[(i + 1) % n].y) / 2 < -1e-9);

    return {
        pts: unit.map((p) => ({
            x: -w / 2 + (p.x - minX) * sx,
            y: (p.y - minY) * sy,
        })),
        center: { x: -w / 2 - minX * sx, y: -minY * sy },
        depth: spanY * sy,
        back,
    };
}

// вершина невидима, если оба соседних ребра основания сзади
function hiddenVertex(back, i) {
    const n = back.length;
    return back[i] && back[(i - 1 + n) % n];
}

function drawPrism(ctx, w, h, n, phase) {
    const base = basePolygon(w, h, n, phase, h * 0.4);
    const top = base.pts.map((p) => [p.x, -h / 2 + p.y]);
    const bottom = base.pts.map((p) => [p.x, h / 2 - base.depth + p.y]);

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        edges(ctx, false, [[top[i], top[j]]]);
        edges(ctx, base.back[i], [[bottom[i], bottom[j]]]);
        edges(ctx, hiddenVertex(base.back, i), [[top[i], bottom[i]]]);
    }
}

function drawPyramid(ctx, w, h, n, phase) {
    const base = basePolygon(w, h, n, phase, h * 0.4);
    const y0 = h / 2 - base.depth;
    const pts = base.pts.map((p) => [p.x, y0 + p.y]);
    // вершина над центром основания
    const apex = [base.center.x, -h / 2];

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        edges(ctx, base.back[i], [[pts[i], pts[j]]]);
        edges(ctx, hiddenVertex(base.back, i), [[apex, pts[i]]]);
    }
}

// четырёхугольная пирамида: основание — параллелограмм, как нижняя грань куба
function drawPyramid4(ctx, w, h) {
    const ox = w * DEPTH;
    const oy = Math.min(h * DEPTH, ox);
    const l = -w / 2;
    const r = w / 2 - ox;
    const b = h / 2;

    const fl = [l, b];
    const fr = [r, b];
    const kr = [r + ox, b - oy];
    const kl = [l + ox, b - oy];
    // вершина над центром основания
    const apex = [(l + r + ox) / 2, -h / 2];

    edges(ctx, false, [
        [fl, fr],
        [fr, kr],
        [apex, fl],
        [apex, fr],
        [apex, kr],
    ]);
    edges(ctx, true, [
        [kl, fl],
        [kl, kr],
        [apex, kl],
    ]);
}

function edges(ctx, hidden, list) {
    ctx.save();
    if (hidden) {
        // пунктир масштабируется с толщиной линии
        const lw = ctx.lineWidth;
        ctx.setLineDash([Math.max(4, lw * 3), Math.max(4, lw * 2.5)]);
    }
    ctx.beginPath();
    for (const [a, b] of list) {
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();
    ctx.restore();
}

// ---------------------------------
// графики
// ---------------------------------

const SAMPLES = 120;

// y = x²: вершина внизу посередине, ветви упираются в верхние углы
function parabolaPoints(w, h) {
    const pts = [];
    for (let i = 0; i <= SAMPLES; i++) {
        const u = -1 + (2 * i) / SAMPLES;
        pts.push([(u * w) / 2, h / 2 - u * u * h]);
    }
    return pts;
}

// y = 1/x: две ветви в I и III четвертях рамки
function hyperbolaBranches(w, h) {
    const a = 0.12; // ветвь проходит от (a, 1) до (1, a) в долях полурамки
    const branch = [];
    for (let i = 0; i <= SAMPLES; i++) {
        // логарифмический шаг — гуще там, где кривая круто поворачивает
        const u = a * Math.pow(1 / a, i / SAMPLES);
        branch.push([(u * w) / 2, -((a / u) * h) / 2]);
    }
    return [branch, branch.map(([x, y]) => [-x, -y])];
}

// y = sin x: два периода по ширине рамки
function sinePoints(w, h) {
    const pts = [];
    for (let i = 0; i <= SAMPLES * 2; i++) {
        const u = -1 + i / SAMPLES;
        pts.push([(u * w) / 2, (-Math.sin(2 * Math.PI * u) * h) / 2]);
    }
    return pts;
}

function drawCurve(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
}
