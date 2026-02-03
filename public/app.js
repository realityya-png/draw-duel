const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let timeline = [];
let currentColor = "#000000";

// --- Инструменты ---
document.getElementById("colorPicker").addEventListener("change", e => {
    currentColor = e.target.value;
});

document.getElementById("clear").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    timeline = [];
});

canvas.addEventListener("mousedown", e => {
    drawing = true;
    ctx.beginPath();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    ctx.moveTo(e.offsetX, e.offsetY);
    timeline.push({
        type: "start",
        x: e.offsetX,
        y: e.offsetY,
        color: currentColor
    });
});

canvas.addEventListener("mousemove", e => {
    if (!drawing) return;
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    timeline.push({
        type: "draw",
        x: e.offsetX,
        y: e.offsetY
    });
});

canvas.addEventListener("mouseup", () => {
    if (!drawing) return;
    drawing = false;

    timeline.push({
        type: "end"
    });
});

canvas.addEventListener("mouseleave", () => {
    if (!drawing) return;
    drawing = false;

    timeline.push({
        type: "end"
    });
});

// --- Завершение рисунка ---
document.getElementById("finish").addEventListener("click", async () => {
    const word = window.currentWord;

    if (!word) {
        alert("Слово не загружено");
        return;
    }

    if (timeline.length === 0) {
        alert("Нарисуйте что-нибудь!");
        return;
    }

    const res = await fetch("/api/draw", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeline, word })
    });

    const data = await res.json();
    window.location.href = `/view/${data.id}`;
});
