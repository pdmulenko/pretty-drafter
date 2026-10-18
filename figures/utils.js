export const CLOSE_RADIUS = 10;
export const HANDLE_RADIUS = 10;
export const ROTATE_HANDLE_OFFSET = 28;

export function toLocalPoint(g, pos) {
    const sin = Math.sin(-g.angle);
    const cos = Math.cos(-g.angle);

    const dx = pos.x - g.cx;
    const dy = pos.y - g.cy;

    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

export function toWorldPoint(g, p) {
    const sin = Math.sin(g.angle);
    const cos = Math.cos(g.angle);

    return {
        x: g.cx + p.x * cos - p.y * sin,
        y: g.cy + p.x * sin + p.y * cos,
    };
}

// вектор якорь → курсор в локальных осях фигуры (не зависит от текущего центра)
export function localDelta(g, anchor, pos) {
    const sin = Math.sin(-g.angle);
    const cos = Math.cos(-g.angle);

    const dx = pos.x - anchor.x;
    const dy = pos.y - anchor.y;

    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

// сдвигаем центр так, чтобы локальная точка anchorLocal оказалась в anchorWorld
export function pinAnchor(g, anchorWorld, anchorLocal) {
    const sin = Math.sin(g.angle);
    const cos = Math.cos(g.angle);

    g.cx = anchorWorld.x - (anchorLocal.x * cos - anchorLocal.y * sin);
    g.cy = anchorWorld.y - (anchorLocal.x * sin + anchorLocal.y * cos);
}

// курсор ресайза по направлению центр → хэндл (учитывает поворот)
export function resizeCursorByDirection(center, handle) {
    const deg =
        ((Math.atan2(handle.y - center.y, handle.x - center.x) * 180) /
            Math.PI +
            360) %
        180;
    if (deg < 22.5 || deg >= 157.5) return "ew-resize";
    if (deg < 67.5) return "nwse-resize";
    if (deg < 112.5) return "ns-resize";
    return "nesw-resize";
}

export function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getLocalBounds(points) {
    let minX = Infinity,
        minY = Infinity;
    let maxX = -Infinity,
        maxY = -Infinity;

    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }

    return { minX, minY, maxX, maxY };
}

export function getRotateHandle(g) {
    const sin = Math.sin(g.angle);
    const cos = Math.cos(g.angle);
    return {
        x: g.cx + 0 * cos - (-g.h / 2 - ROTATE_HANDLE_OFFSET) * sin,
        y: g.cy + 0 * sin + (-g.h / 2 - ROTATE_HANDLE_OFFSET) * cos,
    };
}

export function pointInPolygon(points, p) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const xi = points[i].x,
            yi = points[i].y;
        const xj = points[j].x,
            yj = points[j].y;
        const intersect =
            yi > p.y !== yj > p.y &&
            p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}
