const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let playState = "idle"; // idle | playing | finished
let playTimer = null;

let drawingData = null;
const drawingId = window.location.pathname.split("/").pop();

/* -----------------------------
   Загрузка рисунка
------------------------------ */
async function loadDrawing() {
    const res = await fetch(`/api/draw/${drawingId}`);
    drawingData = await res.json();
}
loadDrawing();

/* -----------------------------
   Применение стиля кисти
------------------------------ */
function applyBrush(p) {
    ctx.strokeStyle = p.color || "#000";
    ctx.lineWidth = p.size || 4;
    ctx.lineCap = p.brushType || "round";
    ctx.lineJoin = p.brushType || "round";
    ctx.globalCompositeOperation =
        p.mode === "erase" ? "destination-out" : "source-over";
}

/* -----------------------------
   Воспроизведение
------------------------------ */
function playDrawing() {
    if (!drawingData) return;
    if (playState !== "idle") return;

    playState = "playing";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let i = 0;

    function step() {
        if (i >= drawingData.timeline.length) {
            playState = "finished";
            return;
        }

        const p = drawingData.timeline[i];

        if (p.type === "start") {
            applyBrush(p);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
        }
        else if (p.type === "draw") {
            applyBrush(p);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
        else if (p.type === "end") {
            ctx.closePath();
        }

        i++;
        playTimer = setTimeout(step, 10);
    }

    step();
}

document.getElementById("playBtn").onclick = playDrawing;

/* -----------------------------
   Пропуск (мгновенная отрисовка)
------------------------------ */
document.getElementById("skipBtn").onclick = () => {
    if (!drawingData) return;
    if (playState === "finished") return;

    if (playTimer) {
        clearTimeout(playTimer);
        playTimer = null;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawingData.timeline.forEach(p => {
        if (p.type === "start") {
            applyBrush(p);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
        }
        else if (p.type === "draw") {
            applyBrush(p);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
        else if (p.type === "end") {
            ctx.closePath();
        }
    });

    playState = "finished";
    document.getElementById("playBtn").disabled = true;
    document.getElementById("skipBtn").disabled = true;
};

/* -----------------------------
   Проверка ответа (через сервер)
------------------------------ */
document.getElementById("checkBtn").onclick = async () => {
    const guess = document.getElementById("userGuess").value.toLowerCase().trim();
    const feedback = document.getElementById("feedback");

    const res = await fetch(`/api/guess/${drawingId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess })
    });

    const data = await res.json();

    if (data.correct) {
        feedback.innerText = "✅ Верно! Баллы начислены!";
        feedback.style.color = "green";
    } else {
        feedback.innerText = "❌ Неверно, попробуй снова!";
        feedback.style.color = "red";
    }
};
