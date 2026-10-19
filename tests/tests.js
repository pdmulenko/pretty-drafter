// ---------------------------------
// ------ тесты Pretty Drafter ------
// ---------------------------------
// открыть /tests/ через локальный сервер: доска грузится во фрейме,
// сценарии гоняют её синтетическими событиями указателя и клавиатуры

const frame = document.getElementById("app");
const log = document.getElementById("log");
let passed = 0;
let failed = 0;

function group(title) {
    const el = document.createElement("div");
    el.className = "group";
    el.textContent = title;
    log.appendChild(el);
}

function ok(name, cond, info) {
    const el = document.createElement("div");
    el.className = "row " + (cond ? "pass" : "fail");
    el.textContent =
        (cond ? "PASS " : "FAIL ") +
        name +
        (cond || info === undefined ? "" : "  " + JSON.stringify(info));
    log.appendChild(el);
    cond ? passed++ : failed++;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// свежая доска для каждой группы сценариев
async function freshApp() {
    await new Promise((resolve) => {
        frame.onload = resolve;
        frame.src = "../index.html?t=" + Date.now();
    });
    await sleep(150);
    const win = frame.contentWindow;
    const doc = win.document;
    const errors = [];
    win.addEventListener("error", (e) => errors.push(e.message));
    win.addEventListener("unhandledrejection", (e) =>
        errors.push("rejection: " + e.reason),
    );
    return makeEnv(win, doc, errors);
}

function makeEnv(win, doc, errors) {
    const $ = (sel) => doc.querySelector(sel);
    const pc = doc.getElementById("pointerCanvas");
    const dpr = win.devicePixelRatio || 1;
    const rect = () => pc.getBoundingClientRect();

    const fire = (el, type, x, y, o = {}) => {
        const r = rect();
        el.dispatchEvent(
            new win.PointerEvent(type, {
                clientX: x + r.left,
                clientY: y + r.top,
                button: 0,
                buttons: 1,
                bubbles: true,
                pointerId: 1,
                ...o,
            }),
        );
    };
    const down = (x, y, o) => fire(pc, "pointerdown", x, y, o);
    const up = (x, y, o) => fire(pc, "pointerup", x, y, o);
    const drag = (x0, y0, x1, y1, o = {}, n = 8) => {
        down(x0, y0, o);
        for (let i = 1; i <= n; i++)
            fire(pc, "pointermove", x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, o);
        up(x1, y1, o);
    };
    const click = (x, y) => {
        down(x, y);
        up(x, y);
    };
    const key = (k, code, o = {}) =>
        win.dispatchEvent(new win.KeyboardEvent("keydown", { key: k, code, ...o }));

    // сколько непрозрачных пикселей в прямоугольнике слоя (в CSS-пикселях)
    const ink = (id, x = 0, y = 0, w, h) => {
        const c = doc.getElementById(id);
        w = w ?? c.width / dpr;
        h = h ?? c.height / dpr;
        const d = c
            .getContext("2d")
            .getImageData(x * dpr, y * dpr, Math.max(1, w * dpr), Math.max(1, h * dpr)).data;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
        return n;
    };
    const pixel = (id, x, y) =>
        [...doc.getElementById(id).getContext("2d").getImageData(x * dpr, y * dpr, 1, 1).data];
    // толщина горизонтального штриха в колонке x
    const strokeHeight = (id, x, threshold = 128) => {
        const c = doc.getElementById(id);
        const d = c.getContext("2d").getImageData(x * dpr, 0, 1, c.height).data;
        let a = -1;
        let b = -1;
        for (let y = 0; y < c.height; y++)
            if (d[y * 4 + 3] > threshold) {
                if (a < 0) a = y;
                b = y;
            }
        return a < 0 ? 0 : (b - a + 1) / dpr;
    };

    const tool = (id) => doc.getElementById(id).click();
    const color = (i) => doc.querySelectorAll(".colorBtn")[i].click();
    const thickness = (i) => doc.querySelectorAll(".thicknessBtn")[i].click();
    const clearAll = () => doc.querySelectorAll(".clearBtn").forEach((b) => b.click());
    const TOOL_IDS = [...doc.querySelectorAll("#toolbar button[id]")]
        .map((b) => b.id)
        .filter((id) => !["midthick", "toplayer", "midlayer", "botlayer", "helpBtn"].includes(id));
    const active = () => TOOL_IDS.find((id) => doc.getElementById(id).classList.contains("active"));

    // залитый прямоугольник карандашом
    const block = (x, y, w, h) => {
        tool("pencil");
        thickness(2);
        for (let yy = y; yy <= y + h; yy += 3) drag(x, yy, x + w, yy, {}, 4);
    };

    const pasteImage = async (w, h) => {
        const cv = doc.createElement("canvas");
        cv.width = w;
        cv.height = h;
        cv.getContext("2d").fillRect(0, 0, w, h);
        const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
        const dt = new win.DataTransfer();
        dt.items.add(new win.File([blob], "p.png", { type: "image/png" }));
        doc.dispatchEvent(new win.ClipboardEvent("paste", { clipboardData: dt }));
        await sleep(300);
    };
    const pasteEmpty = async () => {
        doc.dispatchEvent(
            new win.ClipboardEvent("paste", { clipboardData: new win.DataTransfer() }),
        );
        await sleep(50);
    };

    return {
        win, doc, $, pc, dpr, errors, fire, down, up, drag, click, key, ink, pixel,
        strokeHeight, tool, color, thickness, clearAll, active, block, pasteImage,
        pasteEmpty, TOOL_IDS,
        BOT: "boardBottomCanvas",
        MID: "boardMiddleCanvas",
        TMP: "editableCanvas",
    };
}

// ---------------------------------
// ------------ сценарии ------------
// ---------------------------------

async function resizeMath() {
    group("Resize math after rotation (all shapes, all handles)");
    const U = await import("../figures/utils.js");
    const R = await import("../figures/rect.js");
    const C = await import("../figures/circle.js");
    const T = await import("../figures/trapezoid.js");
    const P = await import("../figures/parallelogram.js");
    const TR = await import("../figures/triangle.js");
    const near = (a, b, eps = 1e-6) => U.dist(a, b) < eps;
    let bad = [];

    for (const ang of [0, 0.4, 1.3, Math.PI / 2, 2.5, -2.1]) {
        for (const h of ["nw", "ne", "se", "sw"]) {
            const g = { type: "rect", cx: 300, cy: 300, angle: ang, w: 120, h: 70 };
            g.anchor = R.getOppositeCorner(g, h);
            const target = U.toWorldPoint(g, {
                x: (h.includes("e") ? 1 : -1) * 150,
                y: (h.includes("s") ? 1 : -1) * 90,
            });
            R.rectResize(g, target);
            const opp = { nw: "se", se: "nw", ne: "sw", sw: "ne" }[h];
            const hs = R.getRectHandles(g);
            if (!near(hs.find((c) => c.type === opp), g.anchor) || !near(hs.find((c) => c.type === h), target, 1e-4))
                bad.push(`rect ${h} @${ang}`);
        }
        for (const h of [0, 1, 2]) {
            const g = { type: "circle", cx: 300, cy: 300, angle: ang, params: { rx: 60, ry: 40 }, handle: h, start: {} };
            const A = U.toWorldPoint(g, [{ x: 60, y: 40 }, { x: 0, y: -40 }, { x: -60, y: 0 }][h]);
            const t = U.toWorldPoint(g, [{ x: -120, y: -80 }, { x: 15, y: 100 }, { x: 130, y: -12 }][h]);
            C.circleResize(g, t);
            C.circleResize(g, t);
            const { rx, ry } = g.params;
            const A2 = U.toWorldPoint(g, [{ x: rx, y: ry }, { x: 0, y: -ry }, { x: -rx, y: 0 }][h]);
            if (!near(A2, A)) bad.push(`circle h${h} @${ang}`);
        }
        for (const h of [0, 1]) {
            const g = { type: "trapezoid", cx: 300, cy: 300, angle: ang, params: { topL: 30, topR: 30, bottom: 100, height: 60 }, handle: h };
            g.start = { params: structuredClone(g.params), cx: g.cx, cy: g.cy };
            const A = U.toWorldPoint(g, h === 0 ? { x: 0, y: -30 } : { x: -50, y: 30 });
            const t = U.toWorldPoint(g, h === 0 ? { x: -50, y: 80 } : { x: 90, y: 30 });
            T.trapezoidResize(g, t);
            T.trapezoidResize(g, t);
            const p = g.params;
            const A2 = U.toWorldPoint(g, h === 0 ? { x: 0, y: -p.height / 2 } : { x: -p.bottom / 2, y: p.height / 2 });
            if (!near(A2, A)) bad.push(`trapezoid h${h} @${ang}`);
        }
        for (const h of [2, 3]) {
            const g = { type: "parallelogram", cx: 300, cy: 300, angle: ang, params: { w: 100, h: 60, skew: 15 }, handle: h, start: {} };
            const A = U.toWorldPoint(g, { x: -35, y: -30 });
            const p0 = U.toWorldPoint(g, h === 2 ? { x: 35, y: 30 } : { x: -65, y: 30 });
            P.parallelogramResize(g, p0);
            P.parallelogramResize(g, { x: p0.x + 20, y: p0.y + 30 });
            const { w, h: hh, skew } = g.params;
            if (!near(U.toWorldPoint(g, { x: -w / 2 + skew, y: -hh / 2 }), A)) bad.push(`parallelogram h${h} @${ang}`);
        }
        const g = { type: "triangle", cx: 300, cy: 300, angle: ang, points: [{ x: 0, y: -40 }, { x: -50, y: 40 }, { x: 50, y: 40 }], handle: 1, start: {} };
        TR.triangleResize(g, { x: 200, y: 420 });
        if (!near(U.toWorldPoint(g, g.points[1]), { x: 200, y: 420 })) bad.push(`triangle @${ang}`);
    }
    ok("anchor stays fixed for every handle at 6 angles", bad.length === 0, bad);

    bad = [];
    for (const [dx, dy] of [[100, 10], [-30, -200], [50, -50]]) {
        const e = TR.applyEquilateralConstraint({ x: 0, y: 0 }, { x: dx, y: dy });
        if (Math.abs(Math.abs(e.y) / Math.abs(e.x) - Math.sqrt(3) / 2) > 1e-9) bad.push([dx, dy]);
    }
    ok("Shift gives an equilateral triangle", bad.length === 0, bad);
}

async function toolsAndDrawing() {
    group("Tool buttons and drawing");
    const t = await freshApp();
    const { BOT, TMP } = t;

    const wrong = [];
    for (const id of t.TOOL_IDS) {
        t.tool(id);
        if (t.active() !== id) wrong.push(id);
    }
    ok(`each of ${t.TOOL_IDS.length} tool buttons activates only itself`, wrong.length === 0, wrong);

    t.clearAll();
    t.tool("pencil");
    t.drag(100, 100, 400, 100, {}, 20);
    t.tool("line");
    ok("pencil commits, width 2", t.ink(BOT) > 0 && Math.abs(t.strokeHeight(BOT, 250) - 2) <= 1, t.strokeHeight(BOT, 250));
    t.drag(50, 150, 200, 150);
    ok("line stays undoable", t.ink(TMP) > 0);
    t.key("z", "KeyZ", { ctrlKey: true });
    ok("Ctrl+Z undoes the last line", t.ink(TMP) === 0);

    const ring = t.doc.getElementById("cursorCircle");
    t.clearAll();
    t.tool("marker");
    t.color(2);
    ok("marker: ring cursor 12px", t.pc.classList.contains("eraserCursor") && ring.style.width === "12px", ring.style.width);
    t.drag(100, 200, 400, 200, {}, 20);
    const px = t.pixel(TMP, 250, 200);
    ok("marker: 12px line in the current color", Math.abs(t.strokeHeight(TMP, 250) - 12) <= 2 && px[0] > 200 && px[1] < 60, { h: t.strokeHeight(TMP, 250), px });
    t.key("z", "KeyZ", { metaKey: true });
    ok("marker: Cmd+Z undoes", t.ink(TMP) === 0);
    t.thickness(2);
    ok("marker: ring 30px on thick", ring.style.width === "30px", ring.style.width);

    t.color(0);
    t.tool("highlighter");
    ok("highlighter keeps the thickness chosen right before (5 × 14)", ring.style.width === "70px", ring.style.width);
    t.thickness(1);
    ok("highlighter: ring 28px on medium", ring.style.width === "28px", ring.style.width);
    t.drag(100, 300, 400, 300, {}, 20);
    t.tool("pencil");
    ok("highlighter commits translucent", t.ink(BOT, 250, 300, 1, 1) > 0 && t.pixel(BOT, 250, 300)[3] < 128);

    t.clearAll();
    t.block(100, 80, 300, 60);
    t.tool("eraser");
    ok("eraser: ring 40px", ring.style.width === "40px", ring.style.width);
    t.drag(90, 110, 410, 110, {}, 30);
    ok("eraser removes a 40px band", t.ink(BOT, 250, 95, 1, 30) === 0 && t.ink(BOT, 250, 80, 1, 6) > 0);

    t.tool("pencil");
    t.doc.querySelector(".whiteColorBtn").click();
    t.drag(250, 70, 250, 140);
    t.tool("line");
    const w = t.pixel(BOT, 250, 120);
    ok("white paints over content", w[0] > 240 && w[1] > 240 && w[2] > 240 && w[3] > 200, w);

    ok("no runtime errors", t.errors.length === 0, t.errors);
}

async function figures() {
    group("Shapes, solids, functions");
    const t = await freshApp();
    const { BOT, TMP } = t;
    const boxed = ["rect", "cube", "prism3", "prism6", "pyramid3", "pyramid4", "pyramid6", "parabola", "hyperbola", "sine"];
    const bad = [];

    for (const id of ["triangle", "parallelogram", "trapezoid", "circle", ...boxed]) {
        t.clearAll();
        t.tool(id);
        t.drag(200, 200, 320, 300);
        const preview = t.ink(TMP) > 0;
        if (boxed.includes(id)) {
            // поворот за жёлтый хэндл, затем ресайз за правый нижний угол
            const c = { x: 260, y: 250 };
            const a = 0.6;
            t.drag(260, 172, c.x + 78 * Math.cos(-Math.PI / 2 + a), c.y + 78 * Math.sin(-Math.PI / 2 + a));
            const se = { x: c.x + 60 * Math.cos(a) - 50 * Math.sin(a), y: c.y + 60 * Math.sin(a) + 50 * Math.cos(a) };
            const nw = { x: c.x - 60 * Math.cos(a) + 50 * Math.sin(a), y: c.y - 60 * Math.sin(a) - 50 * Math.cos(a) };
            t.drag(se.x, se.y, nw.x + (se.x - nw.x) * 1.4, nw.y + (se.y - nw.y) * 1.4);
        }
        t.key("Enter", "Enter");
        if (!preview || t.ink(BOT) === 0 || t.ink(TMP) !== 0) bad.push(id);
    }
    ok("each shape: preview → (rotate, resize) → Enter → on the layer", bad.length === 0, bad);

    t.clearAll();
    t.tool("polyline");
    for (const [x, y] of [[100, 400], [200, 450], [300, 400], [300, 400]]) t.click(x, y);
    ok("polyline finishes on a double click", t.ink(BOT, 90, 390, 220, 70) > 0);

    t.clearAll();
    t.tool("circle");
    t.drag(400, 300, 500, 400);
    ok("circle shows a dashed frame while editing", t.ink(TMP, 398, 298, 6, 6) > 0);
    t.key("Escape", "Escape");
    ok("Esc is ignored", t.ink(TMP) > 0);
    t.key("x", "KeyX");
    ok("X cancels the shape", t.ink(TMP) === 0 && t.ink(BOT) === 0);

    ok("no runtime errors", t.errors.length === 0, t.errors);
}

async function imagesAndSelection() {
    group("Images, selection, copy & paste, hand");
    const t = await freshApp();
    const { BOT, MID, TMP } = t;
    const W = t.pc.clientWidth;
    const H = t.pc.clientHeight;

    // картинка: поворот на 90°, ресайз угла в 1.5 раза — противоположный угол на месте
    await t.pasteImage(400, 200);
    ok("image pasted", t.ink(TMP) > 0 && t.active() === undefined);
    const sc = Math.min(W / 400, H / 200, 1);
    const iw = 400 * sc * 0.5;
    const ih = 200 * sc * 0.5;
    const c = { x: W / 2, y: H / 2 };
    t.down(c.x, c.y - ih / 2 - 28);
    for (let i = 1; i <= 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 20;
        t.fire(t.pc, "pointermove", c.x + (ih / 2 + 28) * Math.cos(a), c.y + (ih / 2 + 28) * Math.sin(a));
    }
    t.up(0, 0);
    const corner = { x: c.x - ih / 2, y: c.y + iw / 2 };
    const anchor = { x: c.x + ih / 2, y: c.y - iw / 2 };
    t.drag(corner.x, corner.y, anchor.x + (corner.x - anchor.x) * 1.5, anchor.y + (corner.y - anchor.y) * 1.5);
    ok("image: anchor fixed after rotate + resize", t.ink(TMP, anchor.x - 4, anchor.y + 4, 1, 1) > 0 && t.ink(TMP, anchor.x + 6, anchor.y - 6, 1, 1) === 0);
    t.key("Enter", "Enter");
    ok("image: Enter commits and returns to pencil", t.ink(BOT) > 0 && t.ink(TMP) === 0 && t.active() === "pencil");

    // выделение
    t.clearAll();
    t.block(100, 100, 80, 50);
    t.tool("select");
    t.drag(90, 90, 190, 160);
    ok("selection cuts the area", t.ink(BOT, 95, 95, 90, 60) === 0 && t.ink(TMP) > 0);
    t.drag(140, 125, 340, 125);
    t.tool("pencil");
    ok("selection moves", t.ink(BOT, 95, 95, 90, 60) === 0 && t.ink(BOT, 295, 95, 90, 60) > 0);
    t.tool("select");
    t.drag(290, 90, 390, 160);
    t.drag(340, 125, 340, 325);
    t.key("x", "KeyX");
    ok("X puts the selection back", t.ink(BOT, 295, 95, 90, 60) > 0 && t.ink(BOT, 295, 295, 90, 60) === 0);
    t.drag(290, 90, 390, 160);
    t.key("Delete", "Delete");
    ok("Delete removes the selection", t.ink(BOT) === 0);

    // баг: сдвинутое выделение пропадало при Ctrl+V с картинкой
    t.block(100, 100, 80, 50);
    t.tool("select");
    t.drag(90, 90, 190, 160);
    t.drag(140, 125, 140, 425);
    await t.pasteImage(300, 120);
    ok("paste after moving a selection keeps it at the new place", t.ink(BOT, 95, 395, 90, 60) > 0 && t.ink(BOT, 95, 95, 90, 60) === 0);
    ok("…and the pasted image floats", t.ink(TMP, W / 2 - 5, H / 2 - 5, 10, 10) > 0);
    await t.pasteImage(200, 200);
    ok("paste over a pasted image keeps the first one", t.ink(BOT, W / 2 - 5, H / 2 - 5, 10, 10) > 0);
    t.key("x", "KeyX");

    // Ctrl/Cmd + C
    t.clearAll();
    t.block(100, 100, 80, 40);
    t.tool("select");
    t.drag(90, 90, 190, 150);
    const col0 = t.doc.querySelector(".colorBtn.active");
    t.key("c", "KeyC", { metaKey: true });
    await sleep(200);
    ok("Cmd+C keeps the selection and does not cycle colors", t.ink(TMP) > 0 && t.active() === "select" && t.doc.querySelector(".colorBtn.active") === col0);
    await t.pasteEmpty();
    ok("paste puts the copy at +20px, original stays", t.ink(BOT, 95, 95, 60, 30) > 0 && t.ink(TMP, 115, 115, 60, 30) > 0 && t.active() === "select");
    await t.pasteEmpty();
    ok("next paste cascades to +40px", t.ink(BOT, 115, 115, 10, 10) > 0 && t.ink(TMP, 135, 135, 10, 10) > 0);
    t.key("Enter", "Enter");

    // баг: в системном буфере остался прошлый фрагмент — вставлялся он, а не новая копия
    t.clearAll();
    t.block(100, 100, 80, 40);
    t.tool("select");
    t.drag(90, 90, 190, 150); // A: 100×60
    t.key("c", "KeyC", { metaKey: true });
    t.key("Enter", "Enter");
    t.block(400, 100, 160, 80);
    t.tool("select");
    t.drag(390, 90, 570, 190); // B: 180×100
    t.key("c", "KeyC", { metaKey: true });
    await sleep(100);
    await t.pasteImage(Math.ceil(100 * t.dpr), Math.ceil(60 * t.dpr)); // в буфере всё ещё A
    ok("paste right after Cmd+C uses the new copy, not a stale clipboard", t.ink(TMP, 420, 120, 160, 80) > 0 && t.ink(TMP, 110, 110, 10, 10) === 0 && t.active() === "select");
    t.key("x", "KeyX");

    // ушли из окна (могли скопировать что-то в другой программе) — верим системному буферу
    t.drag(390, 90, 570, 190);
    t.key("c", "KeyC", { metaKey: true });
    t.win.dispatchEvent(new t.win.Event("blur"));
    await t.pasteImage(300, 120);
    ok("after leaving the window, paste takes the system clipboard image", t.ink(TMP, W / 2 - 5, H / 2 - 5, 10, 10) > 0 && t.active() === undefined);
    t.key("x", "KeyX");

    // Cmd+C узнаётся и без code (часть способов ввода), и в русской раскладке
    for (const [k, code, label] of [["c", "", "empty code"], ["с", "KeyC", "Russian layout"]]) {
        t.clearAll();
        t.block(100, 100, 80, 40);
        t.tool("select");
        t.drag(90, 90, 190, 150);
        t.key(k, code, { metaKey: true });
        await sleep(100);
        await t.pasteEmpty();
        ok(`Cmd+C works with ${label}`, t.ink(TMP, 115, 115, 60, 30) > 0 && t.ink(BOT, 95, 95, 60, 30) > 0);
        t.key("Enter", "Enter");
    }
    t.clearAll();
    t.block(100, 300, 80, 40);
    t.tool("select");
    t.drag(90, 290, 190, 350);
    t.key("c", "KeyC", { ctrlKey: true });
    await sleep(200);
    t.drag(140, 320, 540, 320);
    await t.pasteImage(Math.ceil(100 * t.dpr), Math.ceil(60 * t.dpr));
    ok("own copy from the system clipboard: moved original committed, copy next to its copy point", t.ink(BOT, 495, 295, 90, 50) > 0 && t.ink(TMP, 115, 315, 60, 30) > 0);
    t.key("x", "KeyX");
    ok("X removes only the pasted copy", t.ink(TMP) === 0 && t.ink(BOT, 495, 295, 90, 50) > 0);

    // рука
    t.clearAll();
    t.block(100, 100, 40, 20);
    t.doc.querySelector('.layerBtn[data-canvas="boardMiddleCanvas"]').click();
    t.block(300, 100, 40, 20);
    t.tool("hand");
    t.drag(110, 110, 160, 210);
    ok("hand moves every layer", t.ink(BOT, 170, 215, 1, 1) > 0 && t.ink(BOT, 110, 110, 1, 1) === 0 && t.ink(MID, 370, 215, 1, 1) > 0);

    ok("no runtime errors", t.errors.length === 0, t.errors);
}

async function textTool() {
    group("Text");
    const t = await freshApp();
    const { BOT } = t;

    t.color(2);
    t.tool("text");
    t.click(100, 400);
    await sleep(30);
    const box = t.doc.querySelector(".textBox");
    const ta = box?.querySelector("textarea");
    ok("frame with resize and rotate handles", !!box && box.querySelectorAll(".textHandle").length === 2);
    ta.value = "Hello";
    ta.dispatchEvent(new t.win.Event("input"));
    const weights = [0, 1, 2].map((i) => {
        t.thickness(i);
        return ta.style.fontWeight;
    });
    ok("thickness buttons switch 300 / 400 / 700", weights.join() === "300,400,700", weights);
    ta.dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "d", code: "KeyD", bubbles: true }));
    ok("shortcuts are ignored while typing", t.active() === "text");
    ta.dispatchEvent(new t.win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    ok("Enter puts the text on the board", !t.doc.querySelector(".textBox") && t.ink(BOT, 95, 395, 200, 80) > 0);

    ok("no runtime errors", t.errors.length === 0, t.errors);
}

async function layersAndKeys() {
    group("Layers, thickness, shortcuts, help");
    const t = await freshApp();
    const { BOT, MID, TMP } = t;
    const tmpVisible = () => t.win.getComputedStyle(t.doc.getElementById(TMP)).visibility === "visible";

    t.tool("pencil");
    t.drag(100, 100, 200, 100);
    t.doc.querySelector('.clearBtn[data-canvas="boardBottomCanvas"]').click();
    ok("clearing a layer removes the pending stroke", t.ink(BOT) === 0 && t.ink(TMP) === 0);
    t.drag(100, 120, 200, 120);
    ok("drawing after clearing is visible", t.ink(TMP) > 0 && tmpVisible());
    t.doc.querySelector('.visibilityBtn[data-canvas="boardBottomCanvas"]').click();
    ok("hiding the layer hides the pending stroke", !tmpVisible() && t.ink(BOT) > 0);
    t.doc.querySelector('.visibilityBtn[data-canvas="boardBottomCanvas"]').click();
    t.key("2", "Digit2");
    ok("2 switches to the middle layer", t.doc.querySelector(".layerBtn.active").dataset.canvas === MID);
    t.key("3", "Digit3");

    const size = () => t.doc.querySelector(".thicknessBtn.active").dataset.size;
    t.tool("pencil");
    t.thickness(2);
    t.tool("rect");
    ok("thickness kept when switching right after choosing it", size() === "5");
    t.drag(400, 400, 450, 450);
    t.key("Enter", "Enter");
    ok("thickness kept after Enter", size() === "5");
    t.tool("circle");
    ok("thickness reset after drawing", size() === "2");

    const cycle = (k, code, n) => {
        const s = [];
        for (let i = 0; i < n; i++) {
            t.key(k, code);
            s.push(t.active());
        }
        return s.join(",");
    };
    ok("D", cycle("d", "KeyD", 6) === "pencil,marker,highlighter,line,text,pencil");
    ok("E", cycle("e", "KeyE", 4) === "eraser,hand,select,eraser");
    ok("G", cycle("g", "KeyG", 7) === "polyline,triangle,rect,parallelogram,trapezoid,circle,polyline");
    ok("S", cycle("s", "KeyS", 7) === "cube,prism3,prism6,pyramid3,pyramid4,pyramid6,cube");
    ok("F", cycle("f", "KeyF", 4) === "parabola,hyperbola,sine,parabola");
    t.key("s", "KeyS", { metaKey: true });
    ok("Cmd+S is ignored", t.active() === "parabola");

    const help = t.doc.getElementById("helpDialog");
    t.key("?", "Slash");
    ok("? opens help", help.open);
    t.key("d", "KeyD");
    ok("shortcuts are blocked under help", t.active() === "parabola");
    t.key("?", "Slash");
    ok("? closes help", !help.open);

    // три блока слоёв стоят в одной строке
    const tops = [...t.doc.querySelectorAll(".toolGroup .toolBlock")].map((b) => Math.round(b.getBoundingClientRect().top));
    ok("layer blocks stay on one line", tops.length === 3 && new Set(tops).size === 1, tops);
    const tb = t.doc.getElementById("toolbar");
    ok("board starts right under the toolbar", Math.round(t.doc.getElementById("canvasWrapper").getBoundingClientRect().top) === tb.offsetHeight);

    ok("no runtime errors", t.errors.length === 0, t.errors);
}

// ---------------------------------

const summary = document.getElementById("summary");
try {
    await resizeMath();
    await toolsAndDrawing();
    await figures();
    await imagesAndSelection();
    await textTool();
    await layersAndKeys();
} catch (e) {
    ok("test run crashed: " + e.message, false, e.stack);
}
summary.textContent = `${passed} passed, ${failed} failed`;
summary.className = failed ? "fail" : "pass";
document.title = (failed ? "✗ " : "✓ ") + document.title;
window.__testResult = { passed, failed };
