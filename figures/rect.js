import {
    HANDLE_RADIUS,
    ROTATE_HANDLE_OFFSET,
    getRotateHandle,
    dist,
} from "./utils.js";

// конвертация create -> edit
export function rectCreateToEdit(g) {
    if (!g.start || !g.end) return;

    const x1 = g.start.x;
    const y1 = g.start.y;
    const x2 = g.end.x;
    const y2 = g.end.y;

    g.cx = (x1 + x2) / 2;
    g.cy = (y1 + y2) / 2;
    g.w = Math.abs(x2 - x1);
    g.h = Math.abs(y2 - y1);
    g.angle = 0;
    g.mode = "edit";

    delete g.start;
    delete g.end;
}

// хэндлы (вершины + rotate)
export function getRectHandles(g) {
    const hw = g.w / 2;
    const hh = g.h / 2;

    const corners = [
        { x: -hw, y: -hh, type: "nw" },
        { x: hw, y: -hh, type: "ne" },
        { x: hw, y: hh, type: "se" },
        { x: -hw, y: hh, type: "sw" },
    ];

    const sin = Math.sin(g.angle);
    const cos = Math.cos(g.angle);

    return corners.map((p) => ({
        type: p.type,
        x: g.cx + p.x * cos - p.y * sin,
        y: g.cy + p.x * sin + p.y * cos,
    }));
}

export function hitTestRectHandles(g, pos) {
    for (const h of getRectHandles(g)) {
        if (dist(pos, h) < HANDLE_RADIUS) {
            return { type: "resize", handle: h.type };
        }
    }

    const r = getRotateHandle(g);
    if (dist(pos, r) < HANDLE_RADIUS) {
        return { type: "rotate" };
    }

    return null;
}

// противоположный угол как якорь растяжения
export function getOppositeCorner(g, handle) {
    const map = { nw: "se", se: "nw", ne: "sw", sw: "ne" };
    const opp = map[handle];
    const corners = getRectHandles(g);
    return corners.find((c) => c.type === opp);
}

// resize
export function rectResize(g, pos) {
    if (!g.anchor) {
        console.log("nope");
        return;
    }

    const sin = Math.sin(-g.angle);
    const cos = Math.cos(-g.angle);

    const dx = pos.x - g.anchor.x;
    const dy = pos.y - g.anchor.y;

    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    g.w = Math.max(20, Math.abs(lx));
    g.h = Math.max(20, Math.abs(ly));

    const cxLocal = lx / 2;
    const cyLocal = ly / 2;

    g.cx =
        g.anchor.x + cxLocal * Math.cos(g.angle) - cyLocal * Math.sin(g.angle);
    g.cy =
        g.anchor.y + cxLocal * Math.sin(g.angle) + cyLocal * Math.cos(g.angle);
}

// rotate
export function rectRotate(g, pos) {
    const a0 = g.start.startAngle; // угол при начале rotate
    const a1 = Math.atan2(pos.y - g.cy, pos.x - g.cx);
    g.angle = g.start.angle + (a1 - a0);
}

// drawCreate
export function drawRectCreate(ctx, start, end) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(start.x - end.x);
    const h = Math.abs(start.y - end.y);

    ctx.strokeRect(x, y, w, h);
}
export function applySquareConstraint(start, pos) {
    const dx = pos.x - start.x;
    const dy = pos.y - start.y;

    const size = Math.max(Math.abs(dx), Math.abs(dy));

    return {
        x: start.x + Math.sign(dx || 1) * size,
        y: start.y + Math.sign(dy || 1) * size,
    };
}

//drawEdit
export function drawRectEdit(ctx, g, final = false) {
    ctx.save();
    ctx.translate(g.cx, g.cy);
    ctx.rotate(g.angle);
    ctx.strokeRect(-g.w / 2, -g.h / 2, g.w, g.h);
    ctx.restore();
    //console.log("resizeRect in progress");

    if (!final) {
        const handles = getRectHandles(g);
        const rotate = getRotateHandle(g);

        ctx.fillStyle = "#4aa3ff";
        for (const h of handles) {
            ctx.beginPath();
            ctx.arc(h.x, h.y, HANDLE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.fillStyle = "gold";
        ctx.beginPath();
        ctx.arc(rotate.x, rotate.y, HANDLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
    }
}

// проверка попадания в прямоугольник
export function pointInRect(g, pos) {
    const sin = Math.sin(-g.angle);
    const cos = Math.cos(-g.angle);

    const dx = pos.x - g.cx;
    const dy = pos.y - g.cy;

    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    return Math.abs(lx) <= g.w / 2 && Math.abs(ly) <= g.h / 2;
}
