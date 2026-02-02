const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

const drawings = {}; // хранение рисунков

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public"))); // отдаём папку public

// Главная страница рисования
app.get("/", (req, res) => {
    res.sendFile("index.html", { root: path.join(__dirname, "public") });
});

// Сохраняем рисунок
app.post("/api/draw", (req, res) => {
    const { timeline, word } = req.body;
    const id = Date.now().toString();
    drawings[id] = { timeline, word };
    console.log("Сохранено:", id);
    res.json({ id });
});

// Получаем рисунок по id (для view.html)
app.get("/api/draw/:id", (req, res) => {
    const id = req.params.id;
    const drawing = drawings[id];
    if (!drawing) return res.status(404).json({ error: "Не найдено" });
    res.json(drawing);
});

// Страница просмотра рисунка
app.get("/view/:id", (req, res) => {
    res.sendFile("view.html", { root: path.join(__dirname, "public") });
});

// Запуск сервера
app.listen(PORT, () => console.log(`Сервер готов на http://localhost:3000`));
