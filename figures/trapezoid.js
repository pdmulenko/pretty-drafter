import {
    HANDLE_RADIUS,
    ROTATE_HANDLE_OFFSET,
    toWorldPoint,
    toLocalPoint,
    getRotateHandle,
    pointInPolygon,
    dist,
} from "./utils.js";

// конвертация create -> edit
export function trapezoidCreateToEdit(g) {
    if (!g.start || !g.end) return;

    const x1 = g.start.x,
        y1 = g.start.y;
    const x2 = g.end.x,
        y2 = g.end.y;

    g.cx = (x1 + x2) / 2;
    g.cy = (y1 + y2) / 2;
    g.angle = 0;
    g.mode = "edit";

    const w = Math.max(20, Math.abs(x2 - x1));
    const h = Math.max(20, Math.abs(y2 - y1));

    g.params = { topL: w * 0.3, topR: w * 0.3, bottom: w, height: h };

    delete g.start;
    delete g.end;
}

// хэндлы (вершины + rotate)
export function getTrapezoidHandles(g) {
    const { topL, topR, bottom, height } = g.params;
    const h2 = height / 2;

    const local = [
        { x: -bottom / 2, y: h2 }, // 0 LB
        { x: bottom / 2, y: h2 }, // 1 RB
        { x: -topL, y: -h2 }, // 2 LT
        { x: topR, y: -h2 }, // 3 RT
    ];

    const handles = local.map((p, i) => {
        const wp = toWorldPoint(g, p);
        return { type: "resize", handle: i, x: wp.x, y: wp.y };
    });

    // rotate — от верхней грани
    const rLocal = { x: 0, y: -h2 - ROTATE_HANDLE_OFFSET };
    const r = toWorldPoint(g, rLocal);
    handles.push({ type: "rotate", x: r.x, y: r.y });

    return handles;
}

export function hitTestTrapezoidHandles(g, pos) {
    const handles = getTrapezoidHandles(g);

    for (const h of handles) {
        if (dist(h, pos) < HANDLE_RADIUS) {
            if (h.type === "rotate") {
                return { type: "rotate" };
            }

            let cursor = "default";
            if (h.handle === 0) cursor = "ns";
            else if (h.handle === 1) cursor = "ew";
            else cursor = "pointer";

            return {
                type: "resize",
                handle: h.handle,
                cursor: cursor,
            };
        }
    }

    return null;
}

// resize одной вершины
export function trapezoidResize(g, pos) {
    if (g.handle == null) return;

    if (!g.start?.params) {
        g.start = {
            params: structuredClone(g.params),
            cx: g.cx,
            cy: g.cy,
        };
    }

    const { topL, topR, bottom, height } = g.start.params;
    const local = toLocalPoint(g, pos);

    const minW = 20;
    const minH = 20;

    switch (g.handle) {
        case 0: {
            const oldTopWorldY = g.start.cy - height / 2;

            const newHeight = Math.max(minH, local.y + height / 2);
            g.params.height = newHeight;

            // сдвигаем центр, чтобы верх остался на месте
            g.cy = oldTopWorldY + newHeight / 2;
            break;
        }
        case 1: {
            // ---------- init ----------
            if (!g.start.anchor) {
                const { bottom, height } = g.start.params;
                const h2 = height / 2;

                // якорь = левая нижняя (WORLD)
                g.start.anchor = toWorldPoint(g, {
                    x: -bottom / 2,
                    y: h2,
                });
            }

            const { topL, topR, bottom } = g.start.params;
            const anchorWorld = g.start.anchor;

            // ---------- курсор в локальных координатах ЯКОРЯ ----------
            // вектор anchor → cursor в WORLD
            const vx = pos.x - anchorWorld.x;
            const vy = pos.y - anchorWorld.y;

            // локальная ось X трапеции
            const ux = Math.cos(g.angle);
            const uy = Math.sin(g.angle);

            // проекция на локальную X
            const projX = vx * ux + vy * uy;

            const newBottom = Math.max(minW, projX);
            const delta = newBottom - bottom;

            // ---------- верх растёт синхронно ----------
            let newTopL = topL + delta / 2;
            let newTopR = topR + delta / 2;

            // не даём верхнему основанию схлопнуться
            if (newTopL + newTopR < minW) break;

            // ---------- применяем размеры ----------
            g.params.bottom = newBottom;
            g.params.topL = newTopL;
            g.params.topR = newTopR;

            // ---------- компенсация центра ----------
            // новая позиция якоря ПОСЛЕ изменения (в LOCAL)
            const newAnchorLocal = {
                x: -newBottom / 2,
                y: height / 2,
            };

            const newAnchorWorld = toWorldPoint(g, newAnchorLocal);

            // сдвигаем центр так, чтобы якорь остался на месте
            g.cx += anchorWorld.x - newAnchorWorld.x;
            g.cy += anchorWorld.y - newAnchorWorld.y;

            break;
        }
        case 2: // left top
            g.params.topL = Math.max(-local.x, -g.params.topR + minW);
            break;
        case 3: // right top
            g.params.topR = Math.max(local.x, -g.params.topL + minW);
            break;
    }
}

// rotate
export function trapezoidRotate(g, pos) {
    const dx = pos.x - g.cx;
    const dy = pos.y - g.cy;
    const a = Math.atan2(dy, dx);
    g.angle = g.start.angle + (a - g.start.startAngle);
}

// drawCreate
export function drawTrapezoidCreate(ctx, start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.max(20, Math.abs(end.x - start.x));
    const h = Math.max(20, Math.abs(end.y - start.y));

    const top = w * 0.6;
    const bottom = w;

    ctx.beginPath();
    ctx.moveTo(x + (w - top) / 2, y);
    ctx.lineTo(x + (w + top) / 2, y);
    ctx.lineTo(x + bottom, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.stroke();
}

// drawEdit
export function drawTrapezoidEdit(ctx, g, final = false) {
    const { topL, topR, bottom, height } = g.params;
    const h2 = height / 2;

    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.angle);

    ctx.beginPath();
    ctx.moveTo(-topL, -h2);
    ctx.lineTo(topR, -h2);
    ctx.lineTo(bottom / 2, h2);
    ctx.lineTo(-bottom / 2, h2);
    ctx.closePath();
    ctx.stroke();

    if (!final) {
        ctx.fillStyle = "#4aa3ff";
        const pts = [
            { x: -bottom / 2, y: h2 }, // 0
            { x: bottom / 2, y: h2 }, // 1
            { x: -topL, y: -h2 }, // 2
            { x: topR, y: -h2 }, // 3
        ];
        for (const p of pts) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = "gold";
        ctx.beginPath();
        ctx.arc(0, -h2 - ROTATE_HANDLE_OFFSET, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// проверка попадания в трапецию
export function pointInTrapezoid(g, pos) {
    const local = toLocalPoint(g, pos);
    const { topL, topR, bottom, height } = g.params;
    const h2 = height / 2;

    const poly = [
        { x: -topL, y: -h2 },
        { x: topR, y: -h2 },
        { x: bottom / 2, y: h2 },
        { x: -bottom / 2, y: h2 },
    ];

    return pointInPolygon(poly, local);
}
