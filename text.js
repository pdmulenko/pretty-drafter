// ---------------------------------
// ------------- текст -------------
// ---------------------------------
// клик по доске открывает рамку с полем ввода и хэндлами (размер, поворот);
// Enter — на доску, Shift+Enter — новая строка; за рамку можно перетаскивать

const FONT_FAMILY = '"Helvetica Neue", Arial, Helvetica, sans-serif';
const LINE_HEIGHT = 1.2;
// начертание по кнопкам толщины: тонкий / обычный / жирный
const FONT_WEIGHTS = { 1: 300, 2: 400, 5: 700 };
const PAD = 4; // отступ рамки от текста
const BORDER = 1; // толщина рамки
const MIN_SIZE = 8;

let lastSize = 32; // следующий текст начинается с последнего выбранного размера
let editor = null; // { box, ta, ax, ay, angle, size, weight, color }
let getTarget = null; // () => текущий mainCtx

export function initTextTool(getTargetCtx) {
    getTarget = getTargetCtx;
}

export function hasActiveText() {
    return !!editor;
}

// клик по доске: закрываем текущий текст (если был) и открываем новый
export function textPointerDown(pos, { color, lineWidth }) {
    commitText();

    const box = document.createElement("div");
    box.className = "textBox";
    const ta = document.createElement("textarea");
    ta.className = "textEditor";
    ta.wrap = "off";
    ta.spellcheck = false;
    const resize = document.createElement("div");
    resize.className = "textHandle textResize";
    const rotate = document.createElement("div");
    rotate.className = "textHandle textRotate";
    box.append(ta, resize, rotate);
    document.getElementById("canvasWrapper").appendChild(box);

    // (ax, ay) — левый верхний угол рамки в координатах доски;
    // текст начинается ровно в точке клика
    editor = {
        box,
        ta,
        ax: pos.x - BORDER - PAD,
        ay: pos.y - BORDER - PAD,
        angle: 0,
        size: lastSize,
        weight: FONT_WEIGHTS[lineWidth] ?? 400,
        color,
    };
    applyStyle();

    ta.addEventListener("input", layout);
    ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            commitText();
        }
    });

    // перемещение — за рамку
    gesture(box, (p) => ({ p, ax: editor.ax, ay: editor.ay }), (p, s) => {
        editor.ax = s.ax + p.x - s.p.x;
        editor.ay = s.ay + p.y - s.p.y;
    });

    // пропорциональный размер — левый верхний угол неподвижен
    gesture(
        resize,
        () => ({
            size: editor.size,
            w: box.offsetWidth,
            h: box.offsetHeight,
        }),
        (p, s) => {
            const d = toLocal(p.x - editor.ax, p.y - editor.ay);
            const k = (d.x * s.w + d.y * s.h) / (s.w * s.w + s.h * s.h);
            editor.size = Math.max(MIN_SIZE, Math.round(s.size * k));
            lastSize = editor.size;
            applyStyle();
        },
    );

    // поворот вокруг центра рамки
    gesture(
        rotate,
        (p) => {
            const c = center();
            return {
                c,
                angle: editor.angle,
                a0: Math.atan2(p.y - c.y, p.x - c.x),
            };
        },
        (p, s) => {
            editor.angle =
                s.angle + Math.atan2(p.y - s.c.y, p.x - s.c.x) - s.a0;
            // центр на месте → пересчитываем левый верхний угол
            const w = box.offsetWidth;
            const h = box.offsetHeight;
            const off = toWorld(-w / 2, -h / 2);
            editor.ax = s.c.x + off.x;
            editor.ay = s.c.y + off.y;
        },
    );

    // фокус после того, как отработает mousedown по холсту
    setTimeout(() => ta.focus(), 0);
}

// смена цвета/начертания во время набора
export function updateTextStyle({ color, lineWidth }) {
    if (!editor) return;
    editor.color = color;
    editor.weight = FONT_WEIGHTS[lineWidth] ?? 400;
    applyStyle();
    setTimeout(() => editor?.ta.focus(), 0);
}

export function commitText() {
    if (!editor) return;
    const { ta, ax, ay, angle, size, weight, color } = editor;
    const text = ta.value.replace(/\s+$/, "");
    const ctx = getTarget?.();

    if (text && ctx) {
        const lh = size * LINE_HEIGHT;
        const off = BORDER + PAD;

        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
        ctx.textBaseline = "middle";
        // как в textarea: строка высотой lh, глиф по центру строки
        text.split("\n").forEach((line, i) => {
            ctx.fillText(line, off, off + i * lh + lh / 2);
        });
        ctx.restore();
    }

    removeEditor();
}

export function cancelText() {
    removeEditor();
}

// ---------------------------------
// ----------- служебное -----------
// ---------------------------------

function removeEditor() {
    if (!editor) return;
    editor.box.remove();
    editor = null;
}

function applyStyle() {
    const { ta, size, weight, color } = editor;
    ta.style.color = color;
    ta.style.font = `${weight} ${size}px/${LINE_HEIGHT} ${FONT_FAMILY}`;
    layout();
}

// подгоняем размер поля под текст и ставим рамку так,
// чтобы её левый верхний угол (с учётом поворота) оставался в (ax, ay)
function layout() {
    if (!editor) return;
    const { box, ta } = editor;

    ta.style.width = "0px";
    ta.style.height = "0px";
    ta.style.width = Math.max(ta.scrollWidth, 20) + "px";
    ta.style.height = ta.scrollHeight + "px";

    const c = center();
    box.style.left = c.x - box.offsetWidth / 2 + "px";
    box.style.top = c.y - box.offsetHeight / 2 + "px";
    box.style.transform = `rotate(${editor.angle}rad)`;
}

function center() {
    const { box, ax, ay } = editor;
    const off = toWorld(box.offsetWidth / 2, box.offsetHeight / 2);
    return { x: ax + off.x, y: ay + off.y };
}

// поворот вектора в оси рамки и обратно
function toWorld(x, y) {
    const cos = Math.cos(editor.angle);
    const sin = Math.sin(editor.angle);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function toLocal(x, y) {
    const cos = Math.cos(-editor.angle);
    const sin = Math.sin(-editor.angle);
    return { x: x * cos - y * sin, y: x * sin + y * cos };
}

function boardPos(e) {
    const r = document.getElementById("canvasWrapper").getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// перетаскивание элемента рамки: onStart(pos) → state, onMove(pos, state)
function gesture(el, onStart, onMove) {
    el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || e.target !== el) return;
        // без preventDefault поле ввода потеряет фокус
        e.preventDefault();
        e.stopPropagation();
        try {
            el.setPointerCapture(e.pointerId);
        } catch {
            // указатель уже отпущен — тянуть нечего, но и падать не надо
        }
        const state = onStart(boardPos(e));

        const move = (ev) => {
            if (!editor) return;
            onMove(boardPos(ev), state);
            layout();
        };
        const up = () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerup", up);
            el.removeEventListener("pointercancel", up);
            editor?.ta.focus();
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
    });
}
