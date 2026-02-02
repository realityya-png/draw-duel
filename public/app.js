const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = [];
let drawingColor = document.getElementById("colorPicker").value;
let isDrawing = false;

// --- Рисование на canvas ---
canvas.addEventListener("mousedown", (e) => {
    isDrawing = true;
    const x = e.offsetX;
    const y = e.offsetY;
    ctx.beginPath();
    ctx.moveTo(x, y);

    drawing.push({ type: "start", x, y, color: drawingColor });
});

canvas.addEventListener("mousemove", (e) => {
    if (!isDrawing) return;
    const x = e.offsetX;
    const y = e.offsetY;
    ctx.lineTo(x, y);
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();

    drawing.push({ type: "draw", x, y });
});

canvas.addEventListener("mouseup", () => {
    isDrawing = false;
});

canvas.addEventListener("mouseout", () => {
    isDrawing = false;
});

// --- Инструменты ---
document.getElementById("colorPicker").addEventListener("change", (e) => {
    drawingColor = e.target.value;
});

document.getElementById("clear").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawing = [];
});

// --- Кнопка «Воспроизвести» (локально) ---
document.getElementById("replay").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let i = 0;
    function step() {
        if (i >= drawing.length) return;
        const p = drawing[i];
        if (p.type === "start") {
            ctx.beginPath();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.moveTo(p.x, p.y);
        } else if (p.type === "draw") {
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
        i++;
        setTimeout(step, 10);
    }
    step();
});

// --- Кнопка «Завершить» ---
document.getElementById("finish").addEventListener("click", async () => {
    const word = document.getElementById("word").value.trim();
    if (!word) {
        alert("Введите слово!");
        return;
    }

    // Отправляем рисунок на сервер
    const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline: drawing, word }),
    });
    const data = await res.json();

    // Перенаправляем на страницу просмотра
    window.location.href = `/view/${data.id}`;
});
