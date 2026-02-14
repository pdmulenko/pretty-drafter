import {
    HANDLE_RADIUS,
    ROTATE_HANDLE_OFFSET,
    toWorldPoint,
    toLocalPoint,
    getRotateHandle,
    dist,
} from "./utils.js";

// конвертация create -> edit
export function circleCreateToEdit(g) {
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

    g.params = { rx: Math.max(w, h) / 2, ry: Math.max(w, h) / 2 }; // радиусы по X и Y

    delete g.start;
    delete g.end;
}

// хэндлы (3 resize + rotate)
export function getCircleHandles(g) {
    const { rx, ry } = g.params;

    const local = [
        { x: -rx, y: -ry }, // 0 NW — пропорциональный
        { x: 0, y: ry }, // 1 S — вертикальный
        { x: rx, y: 0 }, // 2 E — горизонтальный
    ];

    const handles = local.map((p, i) => {
        const wp = toWorldPoint(g, p);
        return { type: "resize", handle: i, x: wp.x, y: wp.y };
    });

    // rotate
    const rLocal = { x: 0, y: -ry - ROTATE_HANDLE_OFFSET };
    const r = toWorldPoint(g, rLocal);
    handles.push({ type: "rotate", x: r.x, y: r.y });

    return handles;
}

export function hitTestCircleHandles(g, pos) {
    const handles = getCircleHandles(g);

    for (const h of handles) {
        if (dist(h, pos) < HANDLE_RADIUS) {
            if (h.type === "rotate") {
                return { type: "rotate" };
            }

            let cursor = "default";
            if (h.handle === 1) cursor = "ns";
            else if (h.handle === 2) cursor = "ew";
            else cursor = "nw";

            return {
                type: "resize",
                handle: h.handle,
                cursor: cursor,
            };
        }
    }

    return null;
}

// resize одного хэндла
export function circleResize(g, pos) {
    if (g.handle == null) return;

    if (!g.start || !g.start.localPos) {
        g.start = {
            params: structuredClone(g.params),
            localPos: toLocalPoint(g, pos),
        };
    }

    const { rx, ry } = g.start.params;
    const local = toLocalPoint(g, pos);
    const minR = 10;

    switch (g.handle) {
        case 0: {
            // NW — пропорциональный
            if (!g.start.anchor) {
                g.start.anchor = toWorldPoint(g, { x: rx, y: ry });
            }

            const dx0 = g.start.localPos.x;
            const dy0 = g.start.localPos.y;
            const dx = local.x;
            const dy = local.y;

            const startDist = Math.hypot(dx0, dy0);
            const currDist = Math.hypot(dx, dy);

            const r = Math.max(minR, rx + (currDist - startDist) / 2);

            g.params.rx = r;
            g.params.ry = r;

            const newAnchorWorld = toWorldPoint(g, { x: r, y: r });
            g.cx += g.start.anchor.x - newAnchorWorld.x;
            g.cy += g.start.anchor.y - newAnchorWorld.y;
            break;
        }

        case 1: {
            // S — вертикальный
            if (!g.start.anchor) {
                g.start.anchor = toWorldPoint(g, { x: 0, y: -ry });
            }

            const dy0 = g.start.localPos.y;
            const dy = local.y;

            const newRy = Math.max(minR, ry + (dy - dy0) / 2);
            g.params.ry = newRy;

            const newAnchorWorld = toWorldPoint(g, { x: 0, y: -newRy });
            g.cx += g.start.anchor.x - newAnchorWorld.x;
            g.cy += g.start.anchor.y - newAnchorWorld.y;
            break;
        }

        case 2: {
            // E — горизонтальный
            if (!g.start.anchor) {
                g.start.anchor = toWorldPoint(g, { x: -rx, y: 0 });
            }

            const dx0 = g.start.localPos.x;
            const dx = local.x;

            const newRx = Math.max(minR, rx + (dx - dx0) / 2);
            g.params.rx = newRx;

            const newAnchorWorld = toWorldPoint(g, { x: -newRx, y: 0 });
            g.cx += g.start.anchor.x - newAnchorWorld.x;
            g.cy += g.start.anchor.y - newAnchorWorld.y;
            break;
        }
    }
}

// rotate
export function circleRotate(g, pos) {
    const dx = pos.x - g.cx;
    const dy = pos.y - g.cy;
    const a = Math.atan2(dy, dx);
    g.angle = g.start.angle + (a - g.start.startAngle);
}

// drawCreate — пропорционально
export function drawCircleCreate(ctx, start, end) {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const r = Math.max(
        10,
        Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2
    );

    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2);
    ctx.stroke();
}

// drawEdit
export function drawCircleEdit(ctx, g, final = false) {
    const { rx, ry } = g.params;

    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.angle);

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (!final) {
        ctx.fillStyle = "#4aa3ff";
        const pts = [
            { x: -rx, y: -ry }, // 0 NW — пропорциональный
            { x: 0, y: ry }, // 1 S — вертикальный
            { x: rx, y: 0 }, // 2 E — горизонтальный
        ];
        for (const p of pts) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, HANDLE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = "gold";
        ctx.beginPath();
        ctx.arc(0, -ry - ROTATE_HANDLE_OFFSET, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// проверка попадания в круг/эллипс
export function pointInCircle(g, pos) {
    const dx = pos.x - g.cx;
    const dy = pos.y - g.cy;

    const cos = Math.cos(-g.angle);
    const sin = Math.sin(-g.angle);

    // переводим точку в локальные координаты круга
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    // эллипс: (x/rx)^2 + (y/ry)^2 <= 1
    return (
        (lx * lx) / (g.params.rx * g.params.rx) +
            (ly * ly) / (g.params.ry * g.params.ry) <=
        1
    );
}
