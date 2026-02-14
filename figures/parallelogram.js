import {
    HANDLE_RADIUS,
    ROTATE_HANDLE_OFFSET,
    toWorldPoint,
    toLocalPoint,
    getRotateHandle,
    pointInPolygon,
    dist,
} from "./utils.js";

// ------------------------------
// create -> edit
// ------------------------------
export function parallelogramCreateToEdit(g) {
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
    const skew = w * 0.15;

    // верх/низ и смещение верхнего основания
    g.params = {
        w,
        h,
        skew,
    };

    delete g.start;
    delete g.end;
}

// ------------------------------
// хэндлы (4 вершины + rotate)
// ------------------------------
export function getParallelogramHandles(g) {
    const { w, h, skew } = g.params;
    const h2 = h / 2;

    const local = [
        { x: -w / 2 + skew, y: -h2 }, // 0 LT
        { x: w / 2 + skew, y: -h2 }, // 1 RT (верхний правый)
        { x: w / 2 - skew, y: h2 }, // 2 RB
        { x: -w / 2 - skew, y: h2 }, // 3 LB
    ];

    const handles = local.map((p, i) => {
        const wp = toWorldPoint(g, p);
        return { type: "resize", handle: i, x: wp.x, y: wp.y };
    });

    const rLocal = { x: 0, y: -h2 - ROTATE_HANDLE_OFFSET };
    const r = toWorldPoint(g, rLocal);
    handles.push({ type: "rotate", x: r.x, y: r.y });

    return handles;
}

export function hitTestParallelogramHandles(g, pos) {
    const handles = getParallelogramHandles(g);

    for (const h of handles) {
        if (dist(h, pos) < HANDLE_RADIUS) {
            if (h.type === "rotate") {
                return { type: "rotate" };
            }

            let cursor = "default";
            if (h.handle === 3) cursor = "ns";
            else if (h.handle === 2) cursor = "ew";
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

// ------------------------------
// resize одной вершины
// ------------------------------
export function parallelogramResize(g, pos) {
    if (g.handle == null) return;

    // --- инициализация на mouseDown ---
    if (!g.start || !g.start.startPos) {
        const { w, h, skew } = g.params;

        const anchorLocal = {
            x: -w / 2 + skew, // ЛВ
            y: -h / 2,
        };

        g.start = {
            w,
            h,
            skew,
            anchorWorld: toWorldPoint(g, anchorLocal),
            startPos: { x: pos.x, y: pos.y },
        };
    }

    const s = g.start;
    const dx = pos.x - s.startPos.x;
    const dy = pos.y - s.startPos.y;

    // локальные оси фигуры (в world!)
    const ux = Math.cos(g.angle);
    const uy = Math.sin(g.angle);
    const vx = -uy;
    const vy = ux;

    const minW = 20;
    const minH = 20;

    // --- ресайз ---
    switch (g.handle) {
        case 0: {
            // ЛВ — меняем skew
            const proj = dx * ux + dy * uy;
            g.params.skew = s.skew + proj; //Math.max(0, s.skew + proj);
            break;
        }

        case 3: {
            // ЛН — меняем высоту (верх неподвижен)
            const proj = dx * vx + dy * vy;
            g.params.h = Math.max(minH, s.h + proj);
            break;
        }

        case 2: {
            // ПН — меняем ширину (левое ребро неподвижно)
            const proj = dx * ux + dy * uy;
            g.params.w = Math.max(minW, s.w + proj);
            break;
        }
    }

    if (g.handle != 0) {
        // --- компенсация якоря ---
        const { w, h, skew } = g.params;
        const newAnchorLocal = {
            x: -w / 2 + skew,
            y: -h / 2,
        };

        const newAnchorWorld = toWorldPoint(g, newAnchorLocal);

        g.cx += s.anchorWorld.x - newAnchorWorld.x;
        g.cy += s.anchorWorld.y - newAnchorWorld.y;
    }
}

// ------------------------------
// rotate
// ------------------------------
export function parallelogramRotate(g, pos) {
    const dx = pos.x - g.cx;
    const dy = pos.y - g.cy;
    const a = Math.atan2(dy, dx);
    g.angle = g.start.angle + (a - g.start.startAngle);
}

// ------------------------------
// drawCreate
// ------------------------------
export function drawParallelogramCreate(ctx, start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.max(20, Math.abs(end.x - start.x));
    const h = Math.max(20, Math.abs(end.y - start.y));
    const skew = w * 0.15;

    ctx.beginPath();
    ctx.moveTo(x + skew, y);
    ctx.lineTo(x + w + skew, y);
    ctx.lineTo(x + w - skew, y + h);
    ctx.lineTo(x - skew, y + h);
    ctx.closePath();
    ctx.stroke();
}

// ------------------------------
// drawEdit
// ------------------------------
export function drawParallelogramEdit(ctx, g, final = false) {
    const { w, h, skew } = g.params;
    const h2 = h / 2;

    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.angle);

    ctx.beginPath();
    ctx.moveTo(-w / 2 + skew, -h2); // LT
    ctx.lineTo(w / 2 + skew, -h2); // RT
    ctx.lineTo(w / 2 - skew, h2); // RB
    ctx.lineTo(-w / 2 - skew, h2); // LB
    ctx.closePath();
    ctx.stroke();

    if (!final) {
        ctx.fillStyle = "#4aa3ff";
        const pts = [
            { x: -w / 2 + skew, y: -h2 }, // 0
            //{ x: w / 2 + skew, y: -h2 }, // 1
            { x: w / 2 - skew, y: h2 }, // 2
            { x: -w / 2 - skew, y: h2 }, // 3
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

// ------------------------------
// pointIn
// ------------------------------
export function pointInParallelogram(g, pos) {
    const local = toLocalPoint(g, pos);
    const { w, h, skew } = g.params;
    const h2 = h / 2;

    const poly = [
        { x: -w / 2 + skew, y: -h2 }, // LT
        { x: w / 2 + skew, y: -h2 }, // RT
        { x: w / 2 - skew, y: h2 }, // RB
        { x: -w / 2 - skew, y: h2 }, // LB
    ];

    return pointInPolygon(poly, local);
}
