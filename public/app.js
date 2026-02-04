const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let timeline = [];
let currentColor = "#000000";
let brushSize = 4;
let mode = "draw"; // draw | erase
let brushType = "round";
// --- Инструменты ---

document.getElementById("colorPicker").addEventListener("change", e => {
    currentColor = e.target.value;
    mode = "draw";
});

document.getElementById("eraser").onclick = () => {
    mode = "erase";
};

document.getElementById("brushSize").addEventListener("input", e => {
    brushSize = e.target.value;
	
});

document.getElementById("clear").addEventListener("click", () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    timeline = [];
	ctx.fillStyle = currentColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
});

canvas.addEventListener("mousedown", e => {
    drawing = true;

    ctx.beginPath();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = brushType;
    ctx.lineJoin = brushType;
    ctx.globalCompositeOperation =
        mode === "erase" ? "destination-out" : "source-over";

    ctx.moveTo(e.offsetX, e.offsetY);

    timeline.push({
        type: "start",
        x: e.offsetX,
        y: e.offsetY,
        color: currentColor,
        size: brushSize,
        mode,
        brushType
    });
});


    canvas.addEventListener("mousemove", e => {
    if (!drawing) return;

    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();

    timeline.push({
        type: "draw",
        x: e.offsetX,
        y: e.offsetY,
        color: currentColor,
        size: brushSize,
        mode
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
    if (!window.currentWord) {
        alert("Выберите слово!");
        return;
    }

    if (timeline.length === 0) {
        alert("Нарисуйте что-нибудь!");
        return;
    }

    const res = await fetch("/api/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            timeline,
            word: window.currentWord
        })
    });

    const data = await res.json();
    window.location.href = `/view/${data.id}`;
});