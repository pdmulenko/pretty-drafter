let activeImage = null;
let pointerCanvas, tempCanvas, tempCtx, mainCtx;
let dpr = window.devicePixelRatio || 1;

const HANDLE = 10;
const HANDLE_OFFSET = 10;
const ROTATE_OFFSET = 28;

// ---------------------------------
// --------- инициализация ---------
// ---------------------------------

export function initImageTool({
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

export function hasActiveImage() {
    return !!activeImage;
}

export function deleteActiveImage() {
    if (!activeImage) return;
    activeImage = null;
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    //tempCanvas.classList.remove("active");
}

export function insertImage(img) {
    const scale = Math.min(
        tempCanvas.width / dpr / img.width,
        tempCanvas.height / dpr / img.height,
        1,
    );

    activeImage = {
        img,
        x: tempCanvas.width / dpr / 2 - img.width * scale * 0.25,
        y: tempCanvas.height / dpr / 2 - img.height * scale * 0.25,
        width: img.width * scale * 0.5,
        height: img.height * scale * 0.5,
        rotation: 0,
        mode: null,
        aspect: img.width / img.height,
        startState: null,
    };

    draw();
}

// ---------------------------------
// ------------ курсор -------------
// ---------------------------------

export function imagePointerHover(e, canvas) {
    if (!activeImage) {
        canvas.style.cursor = "default";
        return;
    }

    const pos = getCanvasPos(e, canvas);
    const p = toLocalPoint(pos.x, pos.y);

    if (Math.hypot(p.x - activeImage.width / 2, p.y + ROTATE_OFFSET) < HANDLE) {
        canvas.style.cursor = "grab";
        return;
    }

    if (
        pointInRect(
            p.x,
            p.y,
            activeImage.width - HANDLE_OFFSET,
            activeImage.height - HANDLE_OFFSET,
            HANDLE * 2,
            HANDLE * 2,
        )
    ) {
        canvas.style.cursor = "nwse-resize";
        return;
    }

    if (
        pointInRect(
            p.x,
            p.y,
            activeImage.width - HANDLE_OFFSET,
            activeImage.height / 2 - HANDLE_OFFSET,
            HANDLE * 2,
            HANDLE * 2,
        )
    ) {
        canvas.style.cursor = "col-resize";
        return;
    }

    if (
        pointInRect(
            p.x,
            p.y,
            activeImage.width / 2 - HANDLE_OFFSET,
            activeImage.height - HANDLE_OFFSET,
            HANDLE * 2,
            HANDLE * 2,
        )
    ) {
        canvas.style.cursor = "row-resize";
        return;
    }

    if (pointInRect(p.x, p.y, 0, 0, activeImage.width, activeImage.height)) {
        canvas.style.cursor = "move";
        return;
    }

    canvas.style.cursor = "default";
}

// ---------------------------------
// ---------- интеракция -----------
// ---------------------------------

export function imagePointerDown(e, canvas) {
    if (!activeImage) return false;

    const pos = getCanvasPos(e, canvas);
    const p = toLocalPoint(pos.x, pos.y);

    const startState = {
        local: p,
        width: activeImage.width,
        height: activeImage.height,
        aspect: activeImage.aspect,
    };

    // rotate
    if (Math.hypot(p.x - activeImage.width / 2, p.y + ROTATE_OFFSET) < HANDLE) {
        activeImage.mode = "rotate";
        const c = center();
        activeImage.rotateOffset =
            activeImage.rotation - Math.atan2(pos.y - c.y, pos.x - c.x);
        return true;
    }

    // proportional resize
    if (
        pointInRect(
            p.x,
            p.y,
            activeImage.width - HANDLE_OFFSET,
            activeImage.height - HANDLE_OFFSET,
            HANDLE * 2,
            HANDLE * 2,
        )
    ) {
        activeImage.mode = "resize-prop";
        activeImage.startState = startState;
        return true;
    }

    // horizontal resize
    if (
        pointInRect(
            p.x,
            p.y,
            activeImage.width - HANDLE_OFFSET,
            activeImage.height / 2 - HANDLE_OFFSET,
            HANDLE * 2,
            HANDLE * 2,
        )
    ) {
        activeImage.mode = "resize-hor";
        activeImage.startState = startState;
        return true;
    }

    // vertical resize
    if (
        pointInRect(
            p.x,
            p.y,
            activeImage.width / 2 - HANDLE_OFFSET,
            activeImage.height - HANDLE_OFFSET,
            HANDLE * 2,
            HANDLE * 2,
        )
    ) {
        activeImage.mode = "resize-ver";
        activeImage.startState = startState;
        return true;
    }

    // move
    if (pointInRect(p.x, p.y, 0, 0, activeImage.width, activeImage.height)) {
        activeImage.mode = "move";
        activeImage.offsetX = pos.x - activeImage.x;
        activeImage.offsetY = pos.y - activeImage.y;
        return true;
    }

    // do nothing
    return true;
}

export function imagePointerMove(e, canvas) {
    if (!activeImage) return false;

    const pos = getCanvasPos(e, canvas);

    if (activeImage.mode == null) {
        imagePointerHover(e, pointerCanvas);
    } else if (activeImage.mode === "move") {
        activeImage.x = pos.x - activeImage.offsetX;
        activeImage.y = pos.y - activeImage.offsetY;
    } else if (
        activeImage.mode === "resize-prop" ||
        activeImage.mode === "resize-hor" ||
        activeImage.mode === "resize-ver"
    ) {
        const v = toLocalPoint(pos.x, pos.y);
        const s = activeImage.startState;

        // Вычисляем фиксированный угол (противоположный)
        let fixed = { x: 0, y: 0 };
        if (activeImage.mode === "resize-prop") fixed = { x: 0, y: 0 };
        else if (activeImage.mode === "resize-hor")
            fixed = { x: 0, y: activeImage.height };
        else if (activeImage.mode === "resize-ver")
            fixed = { x: activeImage.width, y: 0 };

        // dx/dy в локальной системе
        let dx = v.x - s.local.x;
        let dy = v.y - s.local.y;

        let newW = s.width;
        let newH = s.height;

        if (activeImage.mode === "resize-prop") {
            newW = s.width + dx;
            newH = newW / s.aspect;
        } else if (activeImage.mode === "resize-hor") {
            newW = s.width + dx;
        } else if (activeImage.mode === "resize-ver") {
            newH = s.height + dy;
        }

        // ограничение минимального размера
        newW = Math.max(20, newW);
        newH = Math.max(20, newH);

        // пересчёт центра, чтобы фиксированный угол остался на месте
        const cos = Math.cos(activeImage.rotation);
        const sin = Math.sin(activeImage.rotation);

        const fx =
            activeImage.x +
            fixed.x * cos -
            fixed.y * sin -
            ((fixed.x * newW) / s.width) * cos +
            ((fixed.y * newH) / s.height) * sin;
        const fy =
            activeImage.y +
            fixed.x * sin +
            fixed.y * cos -
            ((fixed.x * newW) / s.width) * sin -
            ((fixed.y * newH) / s.height) * cos;

        activeImage.width = newW;
        activeImage.height = newH;
        activeImage.x = fx;
        activeImage.y = fy;
    } else if (activeImage.mode === "rotate") {
        const c = center();
        canvas.style.cursor = "grabbing";
        activeImage.rotation =
            Math.atan2(pos.y - c.y, pos.x - c.x) + activeImage.rotateOffset;
    }

    draw();
    return true;
}

export function imagePointerUp(e, canvas) {
    if (activeImage) {
        activeImage.mode = null;
        activeImage.startState = null;
        activeImage.aspect = activeImage.width / activeImage.height;
        imagePointerHover(e, pointerCanvas);
    }
}

// ---------------------------------
// ---------- математика -----------
// ---------------------------------

function getCanvasPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}

function pointInRect(px, py, x, y, w, h) {
    return px >= x && px <= x + w && py >= y && py <= y + h;
}

function center() {
    return {
        x: activeImage.x + activeImage.width / 2,
        y: activeImage.y + activeImage.height / 2,
    };
}

function toLocalPoint(px, py) {
    const c = center();
    const dx = px - c.x;
    const dy = py - c.y;
    const cos = Math.cos(-activeImage.rotation);
    const sin = Math.sin(-activeImage.rotation);

    return {
        x: dx * cos - dy * sin + activeImage.width / 2,
        y: dx * sin + dy * cos + activeImage.height / 2,
    };
}

// ---------------------------------
// ----------- рисование -----------
// ---------------------------------

function draw() {
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

    const { width, height, rotation } = activeImage;
    const c = center();

    tempCtx.save();
    tempCtx.translate(c.x, c.y);
    tempCtx.rotate(rotation);
    tempCtx.translate(-width / 2, -height / 2);

    tempCtx.drawImage(activeImage.img, 0, 0, width, height);

    tempCtx.strokeStyle = "#4aa3ff";
    tempCtx.lineWidth = 2; //HANDLE / 2;
    //tempCtx.setLineDash([HANDLE * 2, HANDLE * 2]);
    tempCtx.strokeRect(0, 0, width, height);
    //tempCtx.setLineDash([]);

    // снапы масштабирования
    tempCtx.fillStyle = "#4aa3ff";
    tempCtx.beginPath();
    tempCtx.arc(width, height, HANDLE, 0, Math.PI * 2);
    tempCtx.fill();
    tempCtx.beginPath();
    tempCtx.arc(width / 2, height, HANDLE, 0, Math.PI * 2);
    tempCtx.fill();
    tempCtx.beginPath();
    tempCtx.arc(width, height / 2, HANDLE, 0, Math.PI * 2);
    tempCtx.fill();
    // снап поворота
    tempCtx.fillStyle = "gold";
    tempCtx.beginPath();
    tempCtx.arc(width / 2, -ROTATE_OFFSET, HANDLE, 0, Math.PI * 2);
    tempCtx.fill();

    tempCtx.restore();
}

// ---------------------------------
// ---------- завершение -----------
// ---------------------------------

export function commitImage() {
    if (!activeImage) return;

    const { width, height, rotation, img } = activeImage;
    const c = center();

    mainCtx.save();
    mainCtx.translate(c.x, c.y);
    mainCtx.rotate(rotation);
    mainCtx.drawImage(img, -width / 2, -height / 2, width, height);
    mainCtx.restore();

    deleteActiveImage();
}
