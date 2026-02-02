const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let drawing = false;
let color = "#000";

const colorPicker = document.getElementById("colorPicker");
const clearBtn = document.getElementById("clear");

colorPicker.addEventListener("change", (e) => {
  color = e.target.value;
});

canvas.addEventListener("mousedown", () => {
  drawing = true;
  ctx.beginPath();
});

canvas.addEventListener("mouseup", () => {
  drawing = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";

  ctx.lineTo(x, y);
  ctx.stroke();
});

clearBtn.addEventListener("click", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
