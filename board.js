import {
    initImageTool,
    imagePointerDown,
    imagePointerMove,
    imagePointerUp,
    insertImage,
    hasActiveImage,
    deleteActiveImage,
    commitImage,
} from "./image.js";
import {
    initFiguresTool,
    setFigureTool,
    figuresPointerDown,
    figuresPointerMove,
    figuresPointerUp,
    hasActiveGeom,
    deleteActiveGeom,
    commitGeom,
} from "./figures.js";

let mainCanvas, mainCtx;
const topCanvas = document.getElementById("pointerCanvas");
const topCtx = topCanvas.getContext("2d");
const tempCanvas = document.getElementById("editableCanvas");
const tempCtx = tempCanvas.getContext("2d");
const cursorCircle = document.getElementById("cursorCircle");

let drawing = false;
let tool = "none";
let color = "black";
let layer = "botlayer";
let lightColor = "rgb(170,170,170)";
let lineWidth = 2;
let lastPos = null;
let smoothPos = null;

const pens = ["pencil", "eraser", "highlighter", "line"];
const geom = [
    "polyline",
    "triangle",
    "rect",
    "parallelogram",
    "trapezoid",
    "circle",
];
const tools = [...pens, ...geom];

// ---------------------------------
// ------- обработка курсора -------
// ---------------------------------

function getCanvasPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}

export function commitDrawing() {
    if (tool === "highlighter") {
        mainCtx.globalCompositeOperation = "multiply";
        mainCtx.globalAlpha = 0.2; // желаемая прозрачность для маркера
    }
    mainCtx.setTransform(1, 0, 0, 1, 0, 0); // временно сбрасываем трансформацию
    mainCtx.drawImage(tempCanvas, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0); // возвращаем
    tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    if (tool === "highlighter") {
        mainCtx.globalCompositeOperation = "source-over"; // возвращаем стандартное
        mainCtx.globalAlpha = 1;
    }
}

topCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;

    if (imagePointerDown(e, mainCanvas)) return;

    if (pens.includes(tool) && tool !== "line") {
        drawing = true;

        lastPos = getCanvasPos(e, mainCanvas);
        smoothPos = getCanvasPos(e, mainCanvas);

        //const ctx = tool === "highlighter" ? tempCtx : mainCtx;
        const ctx = tool === "eraser" ? mainCtx : tempCtx;
        applyToolSettings(ctx);

        if (tool === "pencil" || tool === "highlighter") commitDrawing();

        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(lastPos.x, lastPos.y);
        ctx.stroke();
    } else figuresPointerDown(e, mainCanvas);
});

topCanvas.addEventListener("pointermove", (e) => {
    if (imagePointerMove(e, mainCanvas)) return;
    if (figuresPointerMove(e, mainCanvas)) return;

    if (tool === "eraser" || tool === "highlighter") {
        cursorCircle.style.left = e.pageX + "px";
        cursorCircle.style.top = e.pageY + "px";
    }

    if (!drawing) return;

    const currentPos = getCanvasPos(e, mainCanvas);

    //const ctx = tool === "highlighter" ? tempCtx : mainCtx;
    const ctx = tool === "eraser" ? mainCtx : tempCtx;
    applyToolSettings(ctx);

    // лёгкое сглаживание
    smoothPos.x = smoothPos.x * 0.7 + currentPos.x * 0.3;
    smoothPos.y = smoothPos.y * 0.7 + currentPos.y * 0.3;

    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(smoothPos.x, smoothPos.y);
    ctx.stroke();

    lastPos = { ...smoothPos };
});

function stopDrawing(e) {
    imagePointerUp(e, mainCanvas);
    figuresPointerUp(e, mainCanvas);
    drawing = false;
    lastPos = null;
    smoothPos = null;

    //const ctx = tool === "highlighter" ? tempCtx : mainCtx;
    const ctx = tool === "eraser" ? mainCtx : tempCtx;
    ctx.beginPath(); // сброс пути
}

topCanvas.addEventListener("pointerup", (e) => {
    stopDrawing(e);
});
topCanvas.addEventListener("pointercancel", (e) => {
    stopDrawing(e);
});
topCanvas.addEventListener("pointerleave", (e) => {
    stopDrawing(e);
});

// ---------------------------------
// --- переключение инструментов ---
// ---------------------------------

function applyToolSettings(ctx, Tool = null) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 1;
    if (Tool === null) Tool = tool;

    if (Tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = lineWidth * 20;
    } else if (Tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = lightColor;
        ctx.lineWidth = lineWidth * 14;
    } else {
        // pencil
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
    }
}

function updateCursor() {
    topCanvas.style.cursor = "";
    if (tool !== "eraser" && tool !== "highlighter") {
        topCanvas.classList.add("pencilCursor");
        topCanvas.classList.remove("eraserCursor");
        cursorCircle.style.left = "-100px"; // прячем кружок
        cursorCircle.style.top = "-100px";
    } else {
        topCanvas.classList.remove("pencilCursor");
        topCanvas.classList.add("eraserCursor");
        if (tool === "eraser") {
            cursorCircle.style.width = lineWidth * 20 + "px";
            cursorCircle.style.height = lineWidth * 20 + "px";
        } else {
            cursorCircle.style.width = lineWidth * 14 + "px";
            cursorCircle.style.height = lineWidth * 14 + "px";
        }
    }
}

function setActiveTool(newTool) {
    // сведение слоя после highlighter и pencil
    if (pens.includes(tool) && tool !== "eraser") commitDrawing();
    if (tool === "highlighter") tempCanvas.classList.remove("highlighter"); //, "active");
    // убрать выделение старого инструмента
    document.querySelectorAll("#toolbar button").forEach((btn) => {
        if (btn.id === tool) btn.classList.remove("active");
    });

    // сбрасываем настройки рисовательного слоя
    if (tool !== "none") {
        const ctx = newTool === "highlighter" ? tempCtx : mainCtx;
        applyToolSettings(ctx, newTool);
    }

    // если работали с картинкой
    if (hasActiveImage() && newTool !== "picture") commitImage();

    tool = newTool;
    document.getElementById("midthick").click();

    // если работали с примитивом
    if (hasActiveGeom()) commitGeom();

    // подсветка выбранного инструмента
    if (pens.includes(tool)) {
        document.getElementById(tool).classList.add("active");
        if (tool === "highlighter") {
            tempCanvas.classList.add("highlighter"); //, "active");
            tempCtx.globalCompositeOperation = "multiply";
            tempCtx.strokeStyle = lightColor;
            tempCtx.lineWidth = lineWidth * 3;
            tempCtx.lineCap = "round";
            tempCtx.lineJoin = "round";
        } else if (tool === "line") setFigureTool(tool);
    }

    geom.forEach((toolId) => {
        if (tool === toolId) {
            document.getElementById(toolId).classList.add("active");
            //tempCanvas.classList.remove("highlighter"); //, "active");
            setFigureTool(toolId);
        }
    });

    document.querySelectorAll(".colorBtn").forEach((btn) => {
        if (btn.style.background === color && tool !== "eraser")
            btn.classList.add("active");
        else btn.classList.remove("active");
    });

    // подсветка активного слоя
    document.querySelectorAll(".layerBtn").forEach((btn) => {
        if (btn.id === layer) {
            btn.classList.add("active");
            btn.click();
        } else btn.classList.remove("active");
    });

    updateCursor();
}

// ---------------------------------
// ------- клики по кнопкам --------
// ---------------------------------

tools.forEach((toolId) => {
    const btn = document.getElementById(toolId);
    if (btn) {
        btn.onclick = () => setActiveTool(toolId);
    }
});

document.querySelectorAll(".backgroundBtn").forEach((btn) => {
    btn.onclick = () => {
        const cw = document.getElementById("canvasWrapper");
        document
            .querySelectorAll(".backgroundBtn")
            .forEach((b) => b.classList.remove("active"));
        if (btn.dataset.type === "nogrid") {
            cw.className = "";
            cw.style.cssText = "";
        } else {
            cw.className = `${btn.dataset.type}-grid`;
            cw.style.cssText = `--cell: ${btn.dataset.size * 20}px;`;
        }
        btn.classList.add("active");
    };
});

document.querySelectorAll(".colorBtn").forEach((btn) => {
    btn.onclick = () => {
        if (tool !== "eraser") {
            color = btn.style.background;
            lightColor = btn.dataset.light;
            // подсветка выбранного цвета
            document
                .querySelectorAll(".colorBtn")
                .forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
        }
    };
});

document.querySelectorAll(".thicknessBtn").forEach((btn) => {
    btn.onclick = () => {
        lineWidth = parseInt(btn.dataset.size);
        // подсветка активной толщины
        document
            .querySelectorAll(".thicknessBtn")
            .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        updateCursor();
    };
});

document.querySelectorAll(".layerBtn").forEach((btn) => {
    btn.onclick = () => {
        mainCanvas = document.getElementById(btn.dataset.canvas);
        layer = btn.id;
        mainCtx = mainCanvas.getContext("2d");
        // смена z-index временного слоя
        tempCanvas.style.zIndex = parseInt(mainCanvas.style.zIndex) + 1;
        // подсветка активного слоя
        document
            .querySelectorAll(".layerBtn")
            .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        // передача для картинок и примитивов
        initFiguresTool({
            pointerCanvasEl: topCanvas,
            tempCanvasEl: tempCanvas,
            tempCtxEl: tempCtx,
            mainCtxEl: mainCtx,
        });
        initImageTool({
            pointerCanvasEl: topCanvas,
            tempCanvasEl: tempCanvas,
            tempCtxEl: tempCtx,
            mainCtxEl: mainCtx,
        });
    };
});

document.querySelectorAll(".clearBtn").forEach((btn) => {
    btn.onclick = () => {
        const curCanvas = document.getElementById(btn.dataset.canvas);
        const curCtx = curCanvas.getContext("2d");

        if (tool === "highlighter") setActiveTool("highlighter");

        curCtx.clearRect(0, 0, curCanvas.width, curCanvas.height);
    };
});

document.querySelectorAll(".visibilityBtn").forEach((btn) => {
    btn.onclick = () => {
        const curCanvas = document.getElementById(btn.dataset.canvas);
        const useEl = btn.querySelector("use");
        if (btn.classList.contains("active")) {
            curCanvas.style.visibility = "visible";
            useEl.setAttribute("href", "./icons.svg#fa-visible");
            btn.classList.remove("active");
        } else {
            curCanvas.style.visibility = "hidden";
            useEl.setAttribute("href", "./icons.svg#fa-invisible");
            btn.classList.add("active");
        }
    };
});

// ---------------------------------
// ---------- клавиатура -----------
// ---------------------------------

window.addEventListener("keydown", (e) => {
    if (e.repeat) return;

    if (e.code === "KeyC") {
        const buttons = [...document.querySelectorAll(".colorBtn")];

        const i = buttons.findIndex((btn) => btn.style.background === color);

        buttons[(i + 1) % buttons.length].click();
    } else if (e.code === "KeyT") {
        const buttons = [...document.querySelectorAll(".thicknessBtn")];

        const i = buttons.findIndex(
            (btn) => Number(btn.dataset.size) === lineWidth,
        );

        buttons[(i + 1) % buttons.length].click();
    } else if (e.code === "KeyB") {
        const buttons = [...document.querySelectorAll(".backgroundBtn")];

        const i = buttons.findIndex((btn) => btn.classList.contains("active"));

        buttons[(i + 1) % buttons.length].click();
    } else if (e.code === "KeyD") {
        const i = pens.indexOf(tool);
        const newTool = i !== -1 ? pens[(i + 1) % pens.length] : pens[0];
        setActiveTool(newTool);
    } else if (e.code === "KeyG") {
        const i = geom.indexOf(tool);
        const newTool = i !== -1 ? geom[(i + 1) % geom.length] : geom[0];
        setActiveTool(newTool);
    } else if (e.key === "Enter") {
        // завершаем работу с геометрией/картинкой
        if (!hasActiveGeom() && !hasActiveImage()) return;
        if (hasActiveImage()) setActiveTool("pencil");
        else setActiveTool(tool);
    } else if (e.key === "Escape") {
        // отменяем работу с геометрией/картинкой
        if (!hasActiveGeom() && !hasActiveImage()) return;
        if (hasActiveImage()) tool = "pencil";
        deleteActiveImage();
        deleteActiveGeom();
        setActiveTool(tool);
    } else if (e.key.toLowerCase() === "z" && (e.ctrlKey || e.metaKey)) {
        // отменяем последний нарисованный элемент
        if (pens.includes(tool) && tool !== "eraser")
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
    }

    // слои
    const n = e.code.match(/^Digit([1-3])$/);
    if (!n) return;
    const layers = ["boardTopCanvas", "boardMiddleCanvas", "boardBottomCanvas"];
    const layer = layers[Number(n[1]) - 1];
    // Ctrl + 1/2/3 — очистка
    if (e.ctrlKey) {
        document.querySelector(`.clearBtn[data-canvas="${layer}"]`)?.click();
        return;
    }
    // Shift + 1/2/3 — скрыть/показать
    if (e.shiftKey) {
        document
            .querySelector(`.visibilityBtn[data-canvas="${layer}"]`)
            ?.click();
        return;
    }
    // 1/2/3 — активный слой
    document.querySelector(`.layerBtn[data-canvas="${layer}"]`)?.click();
});

// ---------------------------------
// ---------- ресайз окна ----------
// ---------------------------------

function resizeCanvas(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    const rect = { width: window.innerWidth, height: window.innerHeight - 50 };

    // Сохраняем текущее содержимое
    const img = new Image();
    img.src = canvas.toDataURL();

    // Устанавливаем новые размеры
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    //ctx.scale(dpr,dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Восстанавливаем содержимое
    img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
}

function resizeAllCanvases() {
    const layers = [
        "pointerCanvas",
        "editableCanvas",
        "boardTopCanvas",
        "boardMiddleCanvas",
        "boardBottomCanvas",
    ];

    layers.forEach((id) => {
        const canvas = document.getElementById(id);
        const ctx = canvas.getContext("2d");
        resizeCanvas(canvas, ctx);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    resizeAllCanvases();
    setActiveTool("pencil");
});

window.addEventListener("resize", () => {
    resizeAllCanvases();
});

// ---------------------------------
// ------- вставка картинки --------
// ---------------------------------

document.addEventListener("paste", (e) => {
    const item = [...e.clipboardData.items].find((i) =>
        i.type.startsWith("image/"),
    );

    if (!item) return;

    const file = item.getAsFile();
    const img = new Image();

    img.onload = () => {
        setActiveTool("picture");
        //tempCanvas.classList.add("active");
        insertImage(img);
    };

    img.src = URL.createObjectURL(file);
});

// ---------------------------------
// ------ рисование геометрии ------
// ---------------------------------

export function getPencilProperties() {
    return { color, lineWidth };
}
