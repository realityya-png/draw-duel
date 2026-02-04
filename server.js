const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const app = express();
const PORT = 3000;

const fs = require("fs");

const WORDS = JSON.parse(
    fs.readFileSync("./words/nouns.json", "utf-8")
);

import pool from "./db.js";

pool.query("SELECT 1")
  .then(() => console.log("✅ PostgreSQL connected"))
  .catch(err => console.error("❌ PostgreSQL error", err));


/* ---------------- Middleware ---------------- */

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    name: "drawduel.sid",
    secret: "drawduel_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use(express.static(path.join(__dirname, "public")));

/* ---------------- Database ---------------- */

const db = new sqlite3.Database("./database.db", err => {
    if (err) console.error(err);
    else console.log("База данных подключена");
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT UNIQUE,
            password TEXT,
            points INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS drawings (
            id TEXT PRIMARY KEY,
            userId INTEGER,
            timeline TEXT,
            word TEXT,
            guessedBy TEXT DEFAULT '[]',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

/* ---------------- Pages ---------------- */

app.get("/", (_, res) =>
    res.sendFile("index.html", { root: "public" })
);

app.get("/dashboard", (req, res) => {
    if (!req.session.userId) return res.redirect("/");
    res.sendFile("dashboard.html", { root: "public" });
});

app.get("/draw", (req, res) => {
    if (!req.session.userId) return res.redirect("/");
    res.sendFile("draw.html", { root: "public" });
});

app.get("/view/:id", (req, res) => {
    if (!req.session.userId) return res.redirect("/");

    db.get(
        `SELECT * FROM drawings WHERE id = ?`,
        [req.params.id],
        (err, row) => {
            if (!row) return res.status(404).send("Рисунок не найден");
            if (row.userId === req.session.userId) {
                return res.redirect("/dashboard");
            }
            res.sendFile("view.html", { root: "public" });
        }
    );
});

/* ---------------- Auth ---------------- */

app.post("/register", async (req, res) => {
    const { nickname, password } = req.body;
    if (!nickname || !password) return res.status(400).send("Ошибка");

    const hash = await bcrypt.hash(password, 10);
    db.run(
        `INSERT INTO users (nickname, password) VALUES (?, ?)`,
        [nickname, hash],
        function (err) {
            if (err) return res.status(400).send("Ник занят");
            req.session.userId = this.lastID;
            res.redirect("/dashboard");
        }
    );
});

app.post("/login", (req, res) => {
    const { nickname, password } = req.body;

    db.get(
        `SELECT * FROM users WHERE nickname = ?`,
        [nickname],
        async (err, user) => {
            if (!user) return res.status(400).send("Нет пользователя");
            const ok = await bcrypt.compare(password, user.password);
            if (!ok) return res.status(400).send("Неверный пароль");

            req.session.userId = user.id;
            res.redirect("/dashboard");
        }
    );
});

/* ---------------- API ---------------- */

app.post("/api/draw", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Не авторизован" });
    }

    const { timeline, word } = req.body;
    if (!timeline || !word) {
        return res.status(400).json({ error: "Плохие данные" });
    }

    const id = uuidv4();

    db.run(
        `INSERT INTO drawings (id, userId, timeline, word)
         VALUES (?, ?, ?, ?)`,
        [id, req.session.userId, JSON.stringify(timeline), word],
        err => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id });
        }
    );
});

app.get("/api/draw/:id", (req, res) => {
    const userId = req.session.userId;

    db.get(
        `SELECT * FROM drawings WHERE id = ?`,
        [req.params.id],
        (err, row) => {
            if (!row) {
                return res.status(404).json({ error: "Не найдено" });
            }

            const response = {
                timeline: JSON.parse(row.timeline)
            };

            // слово отдаём ТОЛЬКО автору
            if (userId && row.userId === userId) {
                response.word = row.word;
            }

            res.json(response);
        }
    );
});

app.get("/api/available-drawings", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Не авторизован" });
    }

    db.all(
        `
        SELECT drawings.id, users.nickname
        FROM drawings
        JOIN users ON drawings.userId = users.id
        WHERE drawings.userId != ?
          AND guessedBy NOT LIKE ?
        `,
        [req.session.userId, `%${req.session.userId}%`],
        (err, rows) => res.json(rows)
    );
});

app.post("/api/guess/:id", (req, res) => {
    const userId = req.session.userId;
    const { guess } = req.body;

    if (!userId) return res.status(401).json({ error: "Не авторизован" });

    db.get(
        `SELECT * FROM drawings WHERE id = ?`,
        [req.params.id],
        (err, row) => {
            if (!row) return res.status(404).json({ error: "Не найдено" });

            let guessedBy = [];
            try {
                guessedBy = JSON.parse(row.guessedBy || "[]");
            } catch {
                guessedBy = [];
            }

            if (row.userId === userId) {
                return res.status(403).json({ error: "Свой рисунок" });
            }

            if (guessedBy.includes(userId)) {
                return res.status(403).json({ error: "Уже угадал" });
            }

            const correct =
                row.word.toLowerCase() === guess.toLowerCase();

            if (correct) {
                guessedBy.push(userId);

                db.run(
                    `UPDATE drawings SET guessedBy = ? WHERE id = ?`,
                    [JSON.stringify(guessedBy), req.params.id]
                );

                db.run(
                    `UPDATE users SET points = points + 1 WHERE id = ?`,
                    [userId]
                );

                db.run(
                    `UPDATE users SET points = points + 1 WHERE id = ?`,
                    [row.userId]
                );
            }

            res.json({ correct });
        }
    );
});

app.get("/api/my-drawings", (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: "Не авторизован" });
    }

    db.all(
        `
        SELECT id, word, createdAt
        FROM drawings
        WHERE userId = ?
        ORDER BY createdAt DESC
        `,
        [req.session.userId],
        (err, rows) => res.json(rows)
    );
});

app.get("/leaderboard", (req, res) => {
    db.all(
        `SELECT nickname, points FROM users ORDER BY points DESC LIMIT 10`,
        (err, rows) => res.json(rows)
    );
});

app.listen(PORT, () =>
    console.log(`Сервер запущен: http://localhost:${PORT}`)
);

app.get("/word", (req, res) => {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    res.json({ word });
});

function getRandomWords(arr, count = 3) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

app.get("/api/words", (req, res) => {
    const pool = WORDS.easy; // пока только easy
    const words = getRandomWords(pool, 3);
    res.json({ words });
});