import { insertImageAt } from "./image.js";

const dpr = () => window.devicePixelRatio || 1;

// ---------------------------------
// -------------- рука -------------
// ---------------------------------
// двигаем содержимое всех слоёв; то, что уехало за край, теряется

let pan = null;

export function panStart(pos, canvases) {
    pan = {
        start: pos,
        snaps: canvases.map((canvas) => {
            const snap = document.createElement("canvas");
            snap.width = canvas.width;
            snap.height = canvas.height;
            snap.getContext("2d").drawImage(canvas, 0, 0);
            return { canvas, snap };
        }),
    };
}

export function panMove(pos) {
    if (!pan) return false;

    const dx = Math.round((pos.x - pan.start.x) * dpr());
    const dy = Math.round((pos.y - pan.start.y) * dpr());

    for (const { canvas, snap } of pan.snaps) {
        const ctx = canvas.getContext("2d");
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // работаем в физических пикселях
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(snap, dx, dy);
        ctx.restore();
    }
    return true;
}

export function panEnd() {
    pan = null;
}

// ---------------------------------
// ----------- выделение -----------
// ---------------------------------
// рамкой вырезаем кусок активного слоя и превращаем его в «плавающую картинку»

let selection = null;

export function selectStart(pos) {
    selection = { start: pos, end: pos };
}

export function selectMove(pos, tempCtx, tempCanvas) {
    if (!selection) return false;
    selection.end = pos;

    const r = selectionRect();
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.save();
    tempCtx.globalCompositeOperation = "source-over";
    tempCtx.globalAlpha = 1;
    tempCtx.strokeStyle = "#4aa3ff";
    tempCtx.lineWidth = 1;
    tempCtx.setLineDash([6, 4]);
    tempCtx.strokeRect(r.x + 0.5, r.y + 0.5, r.width, r.height);
    tempCtx.restore();
    return true;
}

export function selectEnd(mainCanvas, mainCtx, tempCtx, tempCanvas) {
    if (!selection) return false;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    // ограничиваем рамку размерами холста
    const k = dpr();
    const r = selectionRect();
    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const width = Math.min(mainCanvas.width / k, Math.ceil(r.x + r.width)) - x;
    const height =
        Math.min(mainCanvas.height / k, Math.ceil(r.y + r.height)) - y;
    selection = null;
    if (width < 4 || height < 4) return false;

    // вырезаем в физических пикселях
    const px = { x: x * k, y: y * k, w: width * k, h: height * k };
    const cut = document.createElement("canvas");
    cut.width = px.w;
    cut.height = px.h;
    cut.getContext("2d").putImageData(
        mainCtx.getImageData(px.x, px.y, px.w, px.h),
        0,
        0,
    );

    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.clearRect(px.x, px.y, px.w, px.h);
    mainCtx.restore();

    // X — вернуть вырезанное на исходное место
    const restore = () => {
        mainCtx.save();
        mainCtx.setTransform(1, 0, 0, 1, 0, 0);
        mainCtx.globalCompositeOperation = "source-over";
        mainCtx.globalAlpha = 1;
        mainCtx.drawImage(cut, px.x, px.y);
        mainCtx.restore();
    };

    insertImageAt(cut, { x, y, width, height }, restore);
    return true;
}

function selectionRect() {
    const { start, end } = selection;
    return {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
    };
}
