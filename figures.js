import { getPencilProperties, commitDrawing } from "./board.js";

// ---------------------------------
// --- фигуры ---
import * as Rect from "./figures/rect.js";
import * as Triangle from "./figures/triangle.js";
import * as Trapezoid from "./figures/trapezoid.js";
import * as Parallelogram from "./figures/parallelogram.js";
import * as Circle from "./figures/circle.js";
import * as Boxed from "./figures/boxed.js";

// ---------------------------------
// --- utils / константы ---
import {
    CLOSE_RADIUS,
    HANDLE_RADIUS,
    ROTATE_HANDLE_OFFSET,
    dist,
    toLocalPoint,
    toWorldPoint,
    pointInPolygon,
    getLocalBounds,
    getRotateHandle,
    resizeCursorByDirection,
} from "./figures/utils.js";

// ---------------------------------
// --- canvas & состояние ---
let tempCanvas, pointerCanvas, tempCtx, mainCtx;
let tool = null;
let activeGeom = null;

// тела и графики ведут себя как прямоугольник (рамка + поворот),
// отличается только отрисовка
function kind(type) {
    return Boxed.isBoxed(type) ? "rect" : type;
}

// ---------------------------------
// --------- инициализация ---------
// ---------------------------------
export function initFiguresTool({
    pointerCanvasEl,
    tempCanvasEl,
    tempCtxEl,
    mainCtxEl,
}) {
    pointerCanvas = pointerCanvasEl;
    tempCanvas = tempCanvasEl;
    tempCtx = tempCtxEl;
    mainCtx = mainCtxEl;
}

export function setFigureTool(name) {
    tool = name;
    activeGeom = null;
}

export function hasActiveGeom() {
    return !!activeGeom;
}

export function deleteActiveGeom() {
    if (!activeGeom) return;

    if (activeGeom.type !== "line")
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    activeGeom = null;
}

// ---------------------------------
// ---------- интеракция -----------
// ---------------------------------
export function figuresPointerDown(e, canvas) {
    const pos = getPos(e, canvas);

    if (!tool) return false;

    // создание новой фигуры
    if (!activeGeom) {
        switch (tool) {
            case "line":
                commitDrawing();
                activeGeom = {
                    type: "line",
                    start: pos,
                    end: pos,
                };
                return true;

            case "polyline":
                activeGeom = {
                    type: "polyline",
                    //mode: "edit",
                    points: [pos],
                    closed: false,
                };
                return true;

            case "rect":
            case "triangle":
            case "trapezoid":
            case "parallelogram":
            case "circle":
                activeGeom = {
                    type: tool,
                    mode: "create",
                    start: pos,
                    end: pos,
                };
                return true;
        }
        if (Boxed.isBoxed(tool)) {
            activeGeom = { type: tool, mode: "create", start: pos, end: pos };
            return true;
        }
        return false;
    }

    // редактирование существующей фигуры
    if (activeGeom.mode === "edit") {
        const hit = getHitTest(activeGeom, pos);
        if (hit) {
            activeGeom.editMode = hit.type === "rotate" ? "rotate" : "resize";
            activeGeom.handle = hit.handle ?? null;
            //console.log(hit, activeGeom.handle);

            // данные для resize / rotate
            switch (activeGeom.editMode) {
                case "resize": {
                    // снимок фигуры без служебных полей прошлых жестов
                    const { start, anchor, ...snapshot } = activeGeom;
                    activeGeom.start = structuredClone(snapshot);
                    if (kind(activeGeom.type) === "rect") {
                        activeGeom.anchor = Rect.getOppositeCorner(
                            activeGeom,
                            hit.handle,
                        );
                        //console.log(activeGeom.anchor);
                    } else {
                        activeGeom.handle = hit.handle; // индекс вершины
                    }
                    break;
                }
                case "rotate":
                    activeGeom.start = {
                        angle: activeGeom.angle,
                        startAngle: Math.atan2(
                            pos.y - activeGeom.cy,
                            pos.x - activeGeom.cx,
                        ),
                    };
                    break;
            }
            return true;
        }

        // проверка попадания внутрь фигуры для перемещения
        if (pointInGeom(activeGeom, pos)) {
            activeGeom.editMode = "move";
            activeGeom.start = {
                x: pos.x,
                y: pos.y,
                cx: activeGeom.cx,
                cy: activeGeom.cy,
            };
            return true;
        }
    }

    // для polyline: добавление новой точки
    if (activeGeom.type === "polyline") {
        // проверка на завершение
        if (
            dist(pos, activeGeom.points[activeGeom.points.length - 1]) <
            CLOSE_RADIUS
        ) {
            //activeGeom.closed = true;
            commitGeom();
            return true;
        }
        // проверка на замыкание
        if (
            activeGeom.points.length >= 3 &&
            dist(pos, activeGeom.points[0]) < CLOSE_RADIUS
        ) {
            activeGeom.closed = true;
            commitGeom();
            return true;
        }

        activeGeom.points.push(pos);
        return true;
    }

    return false;
}

export function figuresPointerMove(e, canvas) {
    if (!activeGeom) return false;
    const pos = getPos(e, canvas);

    switch (kind(activeGeom.type)) {
        case "line":
            if (tool === "line" && e.shiftKey) {
                activeGeom.end = snapLineToAngle(activeGeom.start, pos);
            } else {
                activeGeom.end = pos;
            }
            break;
        case "polyline":
            activeGeom.preview = pos;
            break;
        case "rect":
        case "triangle":
        case "trapezoid":
        case "parallelogram":
        case "circle":
            if (activeGeom.mode === "create") {
                // Shift: квадратная рамка (куб, «ровные» графики)
                if (kind(activeGeom.type) === "rect" && e.shiftKey) {
                    activeGeom.end = Rect.applySquareConstraint(
                        activeGeom.start,
                        pos,
                    );
                } else if (activeGeom.type === "triangle" && e.shiftKey) {
                    activeGeom.end = Triangle.applyEquilateralConstraint(
                        activeGeom.start,
                        pos,
                    );
                } else activeGeom.end = pos;
            } else if (activeGeom.mode === "edit") {
                setCursorForGeom(activeGeom, pos, pointerCanvas);
                if (activeGeom.editMode) {
                    switch (activeGeom.editMode) {
                        case "resize":
                            resizeGeom(activeGeom, pos);
                            break;
                        case "rotate":
                            rotateGeom(activeGeom, pos);
                            pointerCanvas.style.cursor = "grabbing";
                            break;
                        case "move":
                            activeGeom.cx =
                                activeGeom.start.cx +
                                (pos.x - activeGeom.start.x);
                            activeGeom.cy =
                                activeGeom.start.cy +
                                (pos.y - activeGeom.start.y);
                            break;
                    }
                    //console.log("resizeRect in progress");
                    draw();
                    return true;
                }
            }
            break;
    }

    draw();
    return true;
}

export function figuresPointerUp(e) {
    if (!activeGeom) return;

    if (activeGeom?.editMode) {
        activeGeom.editMode = null;
        activeGeom.handle = null;
        return;
    }

    switch (kind(activeGeom.type)) {
        case "line":
            //case "polyline":
            commitGeom();
            break;
        case "rect":
            Rect.rectCreateToEdit(activeGeom);
            break;
        case "triangle":
            Triangle.triangleCreateToEdit(activeGeom);
            break;
        case "trapezoid":
            Trapezoid.trapezoidCreateToEdit(activeGeom);
            break;
        case "parallelogram":
            Parallelogram.parallelogramCreateToEdit(activeGeom);
            break;
        case "circle":
            Circle.circleCreateToEdit(activeGeom);
            break;
    }

    draw();
}

// ---------------------------------
// --- универсальные обработчики ---
// ---------------------------------

function setCursorForGeom(g, pos, canvas) {
    const handles = getHandles(g);
    let hit = null;
    for (const h of handles) {
        if (dist(pos, h) < HANDLE_RADIUS) {
            hit = h;
            break;
        }
    }

    // попали в хэндл
    if (hit) {
        if (hit.type === "rotate") {
            canvas.style.cursor = "grab";
            return;
        }

        // у треугольника и верхних вершин параллелограмма/трапеции — свободное перемещение
        const test = hit.type === "resize" ? getHitTest(g, pos) : hit;
        // ns/ew — вдоль локальных осей, иначе по направлению центр → хэндл
        let dir = hit;
        if (test?.cursor === "ns") dir = toWorldPoint(g, { x: 0, y: 1 });
        else if (test?.cursor === "ew") dir = toWorldPoint(g, { x: 1, y: 0 });
        const cursorValue =
            test?.cursor === "pointer" || g.type === "triangle"
                ? "pointer"
                : resizeCursorByDirection({ x: g.cx, y: g.cy }, dir);

        canvas.style.cursor = cursorValue; // стандарт
        canvas.style.setProperty("cursor", `-webkit-${cursorValue}`);
        //canvas.style.setProperty("cursor", `${cursorValue}`);
        return;
    }

    // не попали в хэндл → проверяем тело фигуры
    if (pointInGeom(g, pos)) {
        canvas.style.cursor = "all-scroll";
        return;
    }

    canvas.style.cursor = "default";
}

function getHandles(g) {
    switch (kind(g.type)) {
        case "rect":
            return Rect.getRectHandles(g).concat([
                { type: "rotate", ...getRotateHandle(g) },
            ]);
        case "triangle":
            return Triangle.getTriangleHandles(g);
        case "trapezoid":
            return Trapezoid.getTrapezoidHandles(g);
        case "parallelogram":
            return Parallelogram.getParallelogramHandles(g);
        case "circle":
            return Circle.getCircleHandles(g);
        default:
            return [];
    }
}

function pointInGeom(g, pos) {
    switch (kind(g.type)) {
        case "rect":
            return Rect.pointInRect(g, pos);
        case "triangle":
            return Triangle.pointInTriangle(g, pos);
        case "trapezoid":
            return Trapezoid.pointInTrapezoid(g, pos);
        case "parallelogram":
            return Parallelogram.pointInParallelogram(g, pos);
        case "circle":
            return Circle.pointInCircle(g, pos);
        default:
            return false;
    }
}

function resizeGeom(g, pos) {
    switch (kind(g.type)) {
        case "rect":
            Rect.rectResize(g, pos);
            break;
        case "triangle":
            Triangle.triangleResize(g, pos);
            break;
        case "trapezoid":
            Trapezoid.trapezoidResize(g, pos);
            break;
        case "parallelogram":
            Parallelogram.parallelogramResize(g, pos);
            break;
        case "circle":
            Circle.circleResize(g, pos);
            break;
    }
}

function rotateGeom(g, pos) {
    switch (kind(g.type)) {
        case "rect":
            Rect.rectRotate(g, pos);
            break;
        case "triangle":
            Triangle.triangleRotate(g, pos);
            break;
        case "trapezoid":
            Trapezoid.trapezoidRotate(g, pos);
            break;
        case "parallelogram":
            Parallelogram.parallelogramRotate(g, pos);
            break;
        case "circle":
            Circle.circleRotate(g, pos);
            break;
    }
}

function getHitTest(g, pos) {
    switch (kind(g.type)) {
        case "rect":
            return Rect.hitTestRectHandles(g, pos);
        case "triangle":
            return Triangle.hitTestTriangleHandles(g, pos);
        case "trapezoid":
            return Trapezoid.hitTestTrapezoidHandles?.(g, pos); // если добавим
        case "parallelogram":
            return Parallelogram.hitTestParallelogramHandles?.(g, pos); // если добавим
        case "circle":
            return Circle.hitTestCircleHandles?.(g, pos); // если захотим rotate/move
        default:
            return null;
    }
}

// ---------------------------------
// --------- рисование -------------
// ---------------------------------
export function draw() {
    if (!activeGeom) return;

    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.save();
    if (activeGeom.type === "line") {
        const pencilProps = getPencilProperties();
        tempCtx.strokeStyle = pencilProps.color;
        tempCtx.lineWidth = pencilProps.lineWidth;
    } else {
        tempCtx.strokeStyle = "#4aa3ff";
        tempCtx.fillStyle = "#4aa3ff";
        tempCtx.lineWidth = 2;
    }

    switch (activeGeom.type) {
        case "line":
            drawLine(tempCtx, activeGeom.start, activeGeom.end);
            break;

        case "polyline":
            drawPolyline(tempCtx, activeGeom);
            break;

        case "rect":
            if (activeGeom.mode === "create") {
                Rect.drawRectCreate(tempCtx, activeGeom.start, activeGeom.end);
            } else {
                Rect.drawRectEdit(tempCtx, activeGeom);
            }
            break;

        case "triangle":
            if (activeGeom.mode === "create") {
                Triangle.drawTriangleCreate(
                    tempCtx,
                    activeGeom.start,
                    activeGeom.end,
                );
            } else {
                Triangle.drawTriangleEdit(tempCtx, activeGeom);
            }
            break;

        case "trapezoid":
            if (activeGeom.mode === "create") {
                Trapezoid.drawTrapezoidCreate(
                    tempCtx,
                    activeGeom.start,
                    activeGeom.end,
                );
            } else {
                Trapezoid.drawTrapezoidEdit(tempCtx, activeGeom);
            }
            break;

        case "parallelogram":
            if (activeGeom.mode === "create") {
                Parallelogram.drawParallelogramCreate(
                    tempCtx,
                    activeGeom.start,
                    activeGeom.end,
                );
            } else {
                Parallelogram.drawParallelogramEdit(tempCtx, activeGeom);
            }
            break;

        case "circle":
            if (activeGeom.mode === "create") {
                Circle.drawCircleCreate(
                    tempCtx,
                    activeGeom.start,
                    activeGeom.end,
                );
            } else {
                Circle.drawCircleEdit(tempCtx, activeGeom);
            }
            break;

        default:
            if (!Boxed.isBoxed(activeGeom.type)) break;
            if (activeGeom.mode === "create") {
                Boxed.drawBoxedCreate(
                    tempCtx,
                    activeGeom.type,
                    activeGeom.start,
                    activeGeom.end,
                );
            } else {
                Boxed.drawBoxedEdit(tempCtx, activeGeom);
            }
    }

    tempCtx.restore();
}

// ---------------------------------
// --------- helper functions ------
// ---------------------------------
function drawLine(ctx, a, b) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
}

function snapLineToAngle(start, pos, stepDeg = 15) {
    const dx = pos.x - start.x;
    const dy = pos.y - start.y;

    const len = Math.hypot(dx, dy);
    if (len === 0) return pos;

    const angle = Math.atan2(dy, dx);
    const step = (stepDeg * Math.PI) / 180;

    const snappedAngle = Math.round(angle / step) * step;

    return {
        x: start.x + Math.cos(snappedAngle) * len,
        y: start.y + Math.sin(snappedAngle) * len,
    };
}

function drawPolyline(ctx, geom, final = false) {
    const pts = geom.points;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }

    if (!final && geom.preview) {
        ctx.lineTo(geom.preview.x, geom.preview.y);
    }

    if (geom.closed) {
        ctx.closePath();
    }

    ctx.stroke();

    // снап завершения
    if (!final) {
        ctx.beginPath();
        ctx.arc(
            pts[pts.length - 1].x,
            pts[pts.length - 1].y,
            CLOSE_RADIUS,
            0,
            Math.PI * 2,
        );
        ctx.stroke();
    }

    // снап замыкания
    if (!final && pts.length >= 3) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, CLOSE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// ---------------------------------
// --------- коммит фигуры ---------
// ---------------------------------
export function commitGeom() {
    if (!activeGeom) return;

    const ctx = activeGeom.type === "line" ? tempCtx : mainCtx;
    ctx.save();
    const pencilProps = getPencilProperties();
    ctx.strokeStyle = pencilProps.color;
    ctx.lineWidth = pencilProps.lineWidth;

    switch (activeGeom.type) {
        case "line":
            drawLine(ctx, activeGeom.start, activeGeom.end);
            break;
        case "polyline":
            drawPolyline(ctx, activeGeom, true);
            break;
        case "rect":
            Rect.drawRectEdit(ctx, activeGeom, true);
            break;
        case "triangle":
            Triangle.drawTriangleEdit(ctx, activeGeom, true);
            break;
        case "trapezoid":
            Trapezoid.drawTrapezoidEdit(ctx, activeGeom, true);
            break;
        case "parallelogram":
            Parallelogram.drawParallelogramEdit(ctx, activeGeom, true);
            break;
        case "circle":
            Circle.drawCircleEdit(ctx, activeGeom, true);
            break;
        default:
            if (Boxed.isBoxed(activeGeom.type))
                Boxed.drawBoxedEdit(ctx, activeGeom, true);
    }

    ctx.restore();

    deleteActiveGeom();
}

// ---------------------------------
// --------- события клавиш --------
// ---------------------------------
export function cancelOrCommit() {
    if (activeGeom?.type === "polyline") commitGeom();
}

// ---------------------------------
// --------- утилиты ---------------
// ---------------------------------
function getPos(e, canvas) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}
