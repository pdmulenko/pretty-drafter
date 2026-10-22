import {
    initImageTool,
    imagePointerDown,
    imagePointerMove,
    imagePointerUp,
    insertImage,
    hasActiveImage,
    deleteActiveImage,
    commitImage,
    cancelActiveImage,
    insertImageAt,
    snapshotActiveImage,
    imageHitTest,
} from "./image.js";
import {
    panStart,
    panMove,
    panEnd,
    selectStart,
    selectMove,
    selectEnd,
} from "./editing.js";
import {
    initTextTool,
    textPointerDown,
    commitText,
    updateTextStyle,
} from "./text.js";
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
let thicknessJustChanged = false; // толщину выбрали вручную после последней смены инструмента
let lastPos = null;
let smoothPos = null;

const pens = ["pencil", "marker", "eraser", "highlighter", "line"];
// инструменты с курсором-кольцом: во сколько раз линия толще выбранной толщины
const ringTools = { marker: 6, highlighter: 14, eraser: 20 };
const geom = [
    "polyline",
    "triangle",
    "rect",
    "parallelogram",
    "trapezoid",
    "circle",
];
const drawTools = ["pencil", "marker", "highlighter", "line", "text"]; // цикл по D
const editTools = ["eraser", "hand", "select"]; // цикл по E
const solids = ["cube", "prism3", "prism6", "pyramid3", "pyramid4", "pyramid6"]; // цикл по S
const graphs = ["parabola", "hyperbola", "sine"]; // цикл по F
const figureTools = [...geom, ...solids, ...graphs];
const tools = [...drawTools, ...figureTools, ...editTools];
const boardLayers = ["boardTopCanvas", "boardMiddleCanvas", "boardBottomCanvas"];

initTextTool(() => mainCtx);

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
    // холсты ещё без размера (страница открыта в фоновой вкладке) — сводить нечего
    if (!tempCanvas.width || !tempCanvas.height) return;
    if (mainCtx != null) {
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
}

topCanvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    // начали рисовать — выбор толщины больше не «только что»
    thicknessJustChanged = false;

    // выделение: клик мимо плавающего фрагмента — кладём его и начинаем новое
    if (tool === "select" && hasActiveImage() && !imageHitTest(e, mainCanvas)) {
        commitImage();
        topCanvas.style.cursor = "";
    }

    if (imagePointerDown(e, mainCanvas)) return;

    const pos = getCanvasPos(e, mainCanvas);
    if (tool === "hand") {
        panStart(
            pos,
            boardLayers.map((id) => document.getElementById(id)),
        );
        topCanvas.style.cursor = "grabbing";
        return;
    }
    if (tool === "select") {
        selectStart(pos);
        return;
    }
    if (tool === "text") {
        textPointerDown(pos, { color, lineWidth });
        return;
    }

    if (pens.includes(tool) && tool !== "line") {
        drawing = true;

        lastPos = getCanvasPos(e, mainCanvas);
        smoothPos = getCanvasPos(e, mainCanvas);

        //const ctx = tool === "highlighter" ? tempCtx : mainCtx;
        const ctx = tool === "eraser" ? mainCtx : tempCtx;
        applyToolSettings(ctx);

        // прошлый штрих сводим в слой — отменить можно только последний
        if (tool !== "eraser") commitDrawing();

        ctx.beginPath();
        ctx.moveTo(lastPos.x, lastPos.y);
        ctx.lineTo(lastPos.x, lastPos.y);
        ctx.stroke();
    } else figuresPointerDown(e, mainCanvas);
});

topCanvas.addEventListener("pointermove", (e) => {
    if (imagePointerMove(e, mainCanvas)) return;
    if (figuresPointerMove(e, mainCanvas)) return;
    if (panMove(getCanvasPos(e, mainCanvas))) return;
    if (selectMove(getCanvasPos(e, mainCanvas), tempCtx, tempCanvas)) return;

    if (ringTools[tool]) {
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
    panEnd();
    if (tool === "hand") topCanvas.style.cursor = "grab";
    selectEnd(mainCanvas, mainCtx, tempCtx, tempCanvas);
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
    } else if (Tool === "highlighter") {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = lightColor;
    } else {
        // pencil, marker
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
    }
    ctx.lineWidth = lineWidth * (ringTools[Tool] ?? 1);
}

function updateCursor() {
    topCanvas.style.cursor = "";
    if (!ringTools[tool]) {
        topCanvas.classList.add("pencilCursor");
        topCanvas.classList.remove("eraserCursor");
        cursorCircle.style.left = "-100px"; // прячем кружок
        cursorCircle.style.top = "-100px";
    } else {
        // кольцо размером с линию
        topCanvas.classList.remove("pencilCursor");
        topCanvas.classList.add("eraserCursor");
        const size = lineWidth * ringTools[tool] + "px";
        cursorCircle.style.width = size;
        cursorCircle.style.height = size;
    }
    if (tool === "hand") topCanvas.style.cursor = "grab";
    else if (tool === "text") topCanvas.style.cursor = "text";
}

function setActiveTool(newTool) {
    const prevTool = tool;
    // недописанный текст кладём на доску
    commitText();
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

    // если работали с примитивом
    if (hasActiveGeom()) commitGeom();

    // подсветка выбранного инструмента
    document.getElementById(tool)?.classList.add("active");
    if (pens.includes(tool)) {
        if (tool === "highlighter") {
            tempCanvas.classList.add("highlighter"); //, "active");
            tempCtx.globalCompositeOperation = "multiply";
            tempCtx.strokeStyle = lightColor;
            tempCtx.lineWidth = lineWidth * 3;
            tempCtx.lineCap = "round";
            tempCtx.lineJoin = "round";
        } else if (tool === "line") setFigureTool(tool);
    }

    figureTools.forEach((toolId) => {
        if (tool === toolId) {
            document.getElementById(toolId).classList.add("active");
            //tempCanvas.classList.remove("highlighter"); //, "active");
            setFigureTool(toolId);
        }
    });

    // подсветка активного цвета
    document.querySelectorAll(".colorBtn").forEach((btn) => {
        if (btn.style.background === color && tool !== "eraser")
            btn.classList.add("active");
        else btn.classList.remove("active");
    });

    // сброс толщины (если её только что не выбрали вручную перед сменой инструмента)
    // (Enter/X в геометрии вызывают setActiveTool с тем же инструментом — там не сбрасываем)
    if (!thicknessJustChanged && newTool !== prevTool)
        setThickness(document.getElementById("midthick"));
    thicknessJustChanged = false;

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
            updateTextStyle({ color, lineWidth });
            // подсветка выбранного цвета
            document
                .querySelectorAll(".colorBtn")
                .forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
        }
    };
});

function setThickness(btn) {
    lineWidth = parseInt(btn.dataset.size);
    // подсветка активной толщины
    document
        .querySelectorAll(".thicknessBtn")
        .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updateCursor();
    updateTextStyle({ color, lineWidth });
}

document.querySelectorAll(".thicknessBtn").forEach((btn) => {
    btn.onclick = () => {
        setThickness(btn);
        thicknessJustChanged = true;
    };
});

document.querySelectorAll(".layerBtn").forEach((btn) => {
    btn.onclick = () => {
        if (pens.includes(tool) && tool !== "eraser") commitDrawing();
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
        // проверка видимости для editableCanvas
        tempCanvas.style.visibility = mainCanvas.style.visibility;
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

        if (pens.includes(tool) && tool !== "eraser") commitDrawing();

        curCtx.clearRect(0, 0, curCanvas.width, curCanvas.height);
    };
});

document.querySelectorAll(".visibilityBtn").forEach((btn) => {
    btn.onclick = () => {
        if (pens.includes(tool) && tool !== "eraser") commitDrawing();
        const curCanvas = document.getElementById(btn.dataset.canvas);
        const useEl = btn.querySelector("use");
        if (btn.classList.contains("active")) {
            curCanvas.style.visibility = "visible";
            useEl.setAttribute("href", "./icons.svg#icon-visible");
            btn.classList.remove("active");
            const activeCanvas = document.getElementById(layer);
            if (activeCanvas.dataset.canvas === btn.dataset.canvas) {
                // текущий слой стал видимым -> показать editableCanvas
                tempCanvas.style.visibility = "visible";
            }
        } else {
            curCanvas.style.visibility = "hidden";
            useEl.setAttribute("href", "./icons.svg#icon-invisible");
            btn.classList.add("active");
            const activeCanvas = document.getElementById(layer);
            if (activeCanvas.dataset.canvas === btn.dataset.canvas) {
                // текущий слой стал невидимым -> спрятать editableCanvas
                tempCanvas.style.visibility = "hidden";
            }
        }
    };
});

// ---------------------------------
// ---------- клавиатура -----------
// ---------------------------------

// следующий инструмент группы (или первый, если сейчас выбран чужой)
function nextInGroup(group) {
    const i = group.indexOf(tool);
    return i !== -1 ? group[(i + 1) % group.length] : group[0];
}

window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    // во время набора текста клавиши обрабатывает поле ввода
    if (e.target.tagName === "TEXTAREA") return;
    // справка: «?» открывает и закрывает, пока она открыта — остальное не работает
    if (e.key === "?") {
        toggleHelp();
        return;
    }
    if (helpDialog.open) return;

    // Ctrl/Cmd + C — копировать выделение (до цикла цветов по C);
    // клавишу узнаём и по code, и по key: у части способов ввода code пустой,
    // а в русской раскладке key — кириллическая «с»
    const isC = e.code === "KeyC" || ["c", "C", "с", "С"].includes(e.key);
    if (isC && (e.ctrlKey || e.metaKey)) {
        if (hasActiveImage() && (tool === "select" || tool === "picture")) {
            e.preventDefault();
            copySelection();
        }
        return;
    }

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
        const i = drawTools.indexOf(tool);
        const newTool =
            i !== -1 ? drawTools[(i + 1) % drawTools.length] : drawTools[0];
        setActiveTool(newTool);
    } else if (e.code === "KeyE") {
        const i = editTools.indexOf(tool);
        const newTool =
            i !== -1 ? editTools[(i + 1) % editTools.length] : editTools[0];
        setActiveTool(newTool);
    } else if (e.code === "KeyG") {
        setActiveTool(nextInGroup(geom));
    } else if (e.code === "KeyS" && !e.metaKey && !e.ctrlKey) {
        setActiveTool(nextInGroup(solids));
    } else if (e.code === "KeyF" && !e.metaKey && !e.ctrlKey) {
        setActiveTool(nextInGroup(graphs));
    } else if (e.key === "Enter") {
        // завершаем работу с геометрией/картинкой
        if (!hasActiveGeom() && !hasActiveImage()) return;
        // вставленная картинка → карандаш, выделение остаётся выделением
        setActiveTool(tool === "picture" ? "pencil" : tool);
    } else if (e.code === "KeyX" && !e.ctrlKey && !e.metaKey) {
        // отменяем работу с геометрией/картинкой
        // (не Esc: в полноэкранном режиме macOS он выходит из полноэкранного режима)
        if (!hasActiveGeom() && !hasActiveImage()) return;
        if (tool === "picture") tool = "pencil";
        // для выделения X возвращает фрагмент на место
        cancelActiveImage();
        deleteActiveGeom();
        setActiveTool(tool);
    } else if (e.key === "Delete" || e.key === "Backspace") {
        // удалить плавающий фрагмент/картинку вместе с содержимым
        if (!hasActiveImage()) return;
        deleteActiveImage();
        if (tool === "picture") setActiveTool("pencil");
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
    const wrapper = document.getElementById("canvasWrapper");
    const rect = { width: wrapper.clientWidth, height: wrapper.clientHeight };
    if (!rect.width || !rect.height) return;

    // Сохраняем текущее содержимое (синхронно — повторные вызовы подряд безопасны)
    const img = document.createElement("canvas");
    img.width = canvas.width;
    img.height = canvas.height;
    if (canvas.width && canvas.height) img.getContext("2d").drawImage(canvas, 0, 0);

    // Устанавливаем новые размеры
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    //ctx.scale(dpr,dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Восстанавливаем содержимое
    if (img.width && img.height)
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
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

// блоки тулбара переносятся на новую строку — доска начинается под тулбаром
const toolbar = document.getElementById("toolbar");

// true, если высота тулбара изменилась (тогда холсты уже пересчитаны)
function syncToolbarHeight() {
    const h = toolbar.offsetHeight + "px";
    if (document.documentElement.style.getPropertyValue("--toolbar-h") === h)
        return false;
    document.documentElement.style.setProperty("--toolbar-h", h);
    resizeAllCanvases();
    return true;
}

document.addEventListener("DOMContentLoaded", () => {
    if (!syncToolbarHeight()) resizeAllCanvases();
    setActiveTool("pencil");
});

window.addEventListener("resize", () => {
    if (!syncToolbarHeight()) resizeAllCanvases();
});

// перенос может случиться и без ресайза окна (например, догрузились шрифты)
new ResizeObserver(syncToolbarHeight).observe(toolbar);

// ---------------------------------
// ------------ справка ------------
// ---------------------------------

const helpDialog = document.getElementById("helpDialog");

function toggleHelp() {
    if (helpDialog.open) helpDialog.close();
    else helpDialog.showModal();
}

document.getElementById("helpBtn").onclick = toggleHelp;
helpDialog.querySelector(".closeHelp").onclick = () => helpDialog.close();
// клик по затемнению вокруг окна закрывает справку
helpDialog.addEventListener("click", (e) => {
    const r = helpDialog.getBoundingClientRect();
    const outside =
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom;
    if (outside) helpDialog.close();
});

// ---------------------------------
// ------- вставка картинки --------
// ---------------------------------

// последний скопированный фрагмент (Ctrl/Cmd + C в режиме выделения)
let clip = null;

function copySelection() {
    const snap = snapshotActiveImage();
    if (!snap) return;
    // fresh: после копирования окно не теряло фокус — в другой программе ничего не копировали
    clip = { ...snap, system: false, fresh: true };

    // кладём и в системный буфер — тогда фрагмент можно вставить и в другую программу
    try {
        const blob = new Promise((resolve) =>
            snap.canvas.toBlob(resolve, "image/png"),
        );
        navigator.clipboard
            .write([new ClipboardItem({ "image/png": blob })])
            .then(() => {
                if (clip?.canvas === snap.canvas) clip.system = true;
            })
            .catch(() => {});
    } catch {
        // буфер недоступен — вставим из памяти
    }
}

// копия вставляется рядом с оригиналом в том же размере и остаётся выделенной
function pasteClip() {
    if (tool !== "select") setActiveTool("select");
    else commitImage();

    clip.x += 20;
    clip.y += 20;
    insertImageAt(clip.canvas, {
        x: clip.x,
        y: clip.y,
        width: clip.width,
        height: clip.height,
    });
}

// ушли в другую программу — там могли скопировать своё, тогда верим системному буферу
window.addEventListener("blur", () => {
    if (clip) clip.fresh = false;
});

document.addEventListener("paste", (e) => {
    if (e.target.tagName === "TEXTAREA") return;

    // только что скопировали здесь же — вставляем из памяти: системный буфер
    // мог ещё не обновиться или отказать в записи, и там лежит прошлый фрагмент
    if (clip?.fresh) {
        e.preventDefault();
        pasteClip();
        return;
    }

    const item = [...e.clipboardData.items].find((i) =>
        i.type.startsWith("image/"),
    );

    if (!item) {
        // системный буфер не принял картинку — берём скопированное из памяти
        if (clip && !clip.system) pasteClip();
        return;
    }

    const file = item.getAsFile();
    const img = new Image();

    img.onload = () => {
        // это наш же фрагмент — вставляем как копию, а не как новую картинку
        // (узнаём по размеру: подтверждение записи в буфер может прийти позже вставки)
        if (
            clip &&
            img.naturalWidth === clip.canvas.width &&
            img.naturalHeight === clip.canvas.height
        ) {
            pasteClip();
            return;
        }
        // сдвинутое выделение или прошлая картинка — сначала на доску,
        // иначе новая картинка займёт их место и они пропадут
        commitImage();
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
