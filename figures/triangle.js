import {
    HANDLE_RADIUS,
    ROTATE_HANDLE_OFFSET,
    toWorldPoint,
    toLocalPoint,
    getRotateHandle,
    dist,
} from "./utils.js";

// ---------------------------------
// create -> edit
// ---------------------------------

export function triangleCreateToEdit(g) {
    if (!g.start || !g.end) return;

    const x1 = g.start.x;
    const y1 = g.start.y;
    const x2 = g.end.x;
    const y2 = g.end.y;

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);

    g.cx = cx;
    g.cy = cy;
    g.angle = 0;
    g.mode = "edit";

    // локальные координаты
    g.points = [
        { x: 0, y: -h / 2 }, // верхняя
        { x: -w / 2, y: h / 2 }, // левая нижняя
        { x: w / 2, y: h / 2 }, // правая нижняя
    ];

    delete g.start;
    delete g.end;
}

// ---------------------------------
// handles
// ---------------------------------

function getTriangleRotateHandle(g) {
    // ищем верхнюю вершину в ЛОКАЛЬНЫХ координатах
    let top = g.points[0];
    for (const p of g.points) {
        if (p.y < top.y) top = p;
    }

    // поднимаемся вверх по локальной оси
    return toWorldPoint(g, { x: top.x, y: top.y - ROTATE_HANDLE_OFFSET });
}

export function getTriangleHandles(g) {
    const handles = g.points.map((p, i) => {
        const wp = toWorldPoint(g, p);
        return {
            type: "resize",
            handle: i,
            x: wp.x,
            y: wp.y,
        };
    });

    // rotate handle (triangle-specific)
    const r = getTriangleRotateHandle(g);
    handles.push({ type: "rotate", x: r.x, y: r.y });

    return handles;
}

export function hitTestTriangleHandles(g, pos) {
    // resize handles
    for (let i = 0; i < g.points.length; i++) {
        const wp = toWorldPoint(g, g.points[i]);
        if (dist(wp, pos) < HANDLE_RADIUS) {
            return { type: "resize", handle: i };
        }
    }

    // rotate handle (triangle-specific)
    const r = getTriangleRotateHandle(g);
    if (dist(r, pos) < HANDLE_RADIUS) {
        return { type: "rotate" };
    }

    return null;
}

// ---------------------------------
// resize / rotate
// ---------------------------------

export function triangleResize(g, pos) {
    if (g.handle == null) return;

    if (!g.start?.points) {
        g.start = {
            points: structuredClone(g.points),
        };
    }

    const local = toLocalPoint(g, pos);
    g.points[g.handle] = { x: local.x, y: local.y };
}

export function triangleRotate(g, pos) {
    const dx = pos.x - g.cx;
    const dy = pos.y - g.cy;

    const a = Math.atan2(dy, dx);
    g.angle = g.start.angle + (a - g.start.startAngle);
}

// ---------------------------------
// draw
// ---------------------------------

export function drawTriangleCreate(ctx, start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.max(20, Math.abs(end.x - start.x));
    const h = Math.max(20, Math.abs(end.y - start.y));

    const cx = x + w / 2;

    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.stroke();
}

export function drawTriangleEdit(ctx, g, final = false) {
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.angle);

    ctx.beginPath();
    ctx.moveTo(g.points[0].x, g.points[0].y);
    ctx.lineTo(g.points[1].x, g.points[1].y);
    ctx.lineTo(g.points[2].x, g.points[2].y);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();

    if (!final) {
        const handles = getTriangleHandles(g);
        for (const h of handles) {
            ctx.fillStyle = h.type === "rotate" ? "gold" : "#4aa3ff";
            ctx.beginPath();
            ctx.arc(h.x, h.y, HANDLE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ---------------------------------
// hit test body
// ---------------------------------

export function pointInTriangle(g, pos) {
    const local = toLocalPoint(g, pos);
    const [a, b, c] = g.points;

    const area = (p1, p2, p3) =>
        Math.abs(
            (p1.x * (p2.y - p3.y) +
                p2.x * (p3.y - p1.y) +
                p3.x * (p1.y - p2.y)) /
                2
        );

    const A = area(a, b, c);
    const A1 = area(local, b, c);
    const A2 = area(a, local, c);
    const A3 = area(a, b, local);

    return Math.abs(A - (A1 + A2 + A3)) < 0.01;
}
