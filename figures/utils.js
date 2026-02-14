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
