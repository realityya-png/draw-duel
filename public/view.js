const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let playState = "idle"; // idle | playing | finished
let playTimer = null;

let correctWord = "";
let drawingData = null;
const drawingId = window.location.pathname.split("/").pop();

// Загружаем рисунок
async function loadDrawing() {
    const res = await fetch(`/api/draw/${drawingId}`);
    drawingData = await res.json();
    correctWord = drawingData.word.toLowerCase().trim();
}
loadDrawing();

// Воспроизведение
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
            ctx.beginPath();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.moveTo(p.x, p.y);
        }
        else if (p.type === "draw") {
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

// Проверка угадывания и начисление очков
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
            ctx.beginPath();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.moveTo(p.x, p.y);
        } else if (p.type === "draw") {
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        } else if (p.type === "end") {
            ctx.closePath();
        }
    });

    playState = "finished";
	document.getElementById("playBtn").disabled = true;
    document.getElementById("skipBtn").disabled = true;
};

document.getElementById("guessBtn").onclick = () => {
    const guess = document.getElementById("guess").value.trim().toLowerCase();
    const correct = drawingData.word.toLowerCase();

    if (guess === correct) {
        document.getElementById("result").innerText = "✅ Верно!";
    } else {
        document.getElementById("result").innerText = "❌ Неверно";
    }
};