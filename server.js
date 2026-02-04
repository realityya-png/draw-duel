import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

import pool from "./db.js";

/* ---------------- Setup ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- Words ---------------- */

const WORDS = JSON.parse(
    fs.readFileSync(path.join(__dirname, "words/nouns.json"), "utf-8")
);

function getRandomWords(arr, count = 3) {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

/* ---------------- Middleware ---------------- */

app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
    session({
        name: "drawduel.sid",
        secret: "drawduel_secret_key",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24
        }
    })
);

app.use(express.static(path.join(__dirname, "public")));

/* ---------------- Database init ---------------- */

(async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            nickname TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            points INTEGER DEFAULT 0,
            role TEXT DEFAULT 'user'
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS drawings (
            id TEXT PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            timeline JSONB NOT NULL,
            word TEXT NOT NULL,
            guessed_by INTEGER[] DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("✅ PostgreSQL connected & tables ready");
})();

/* ---------------- Pages ---------------- */

app.get("/", (_, res) =>
    res.sendFile(path.join(__dirname, "public/index.html"))
);

app.get("/dashboard", (req, res) => {
    if (!req.session.userId) return res.redirect("/");
    res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

app.get("/draw", (req, res) => {
    if (!req.session.userId) return res.redirect("/");
    res.sendFile(path.join(__dirname, "public/draw.html"));
});

app.get("/view/:id", async (req, res) => {
    if (!req.session.userId) return res.redirect("/");

    const { rows } = await pool.query(
        "SELECT * FROM drawings WHERE id = $1",
        [req.params.id]
    );

    if (!rows.length) return res.status(404).send("Not found");
    if (rows[0].user_id === req.session.userId)
        return res.redirect("/dashboard");

    res.sendFile(path.join(__dirname, "public/view.html"));
});

/* ---------------- Auth ---------------- */

app.post("/register", async (req, res) => {
    const { nickname, password } = req.body;
    const hash = await bcrypt.hash(password, 10);

    const { rows } = await pool.query(
        "INSERT INTO users (nickname, password) VALUES ($1,$2) RETURNING id",
        [nickname, hash]
    );

    req.session.userId = rows[0].id;
    res.redirect("/dashboard");
});

app.post("/login", async (req, res) => {
    const { nickname, password } = req.body;

    const { rows } = await pool.query(
        "SELECT * FROM users WHERE nickname=$1",
        [nickname]
    );

    if (!rows.length) return res.status(400).send("Ошибка");

    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(400).send("Ошибка");

    req.session.userId = rows[0].id;
    res.redirect("/dashboard");
});

/* ---------------- API ---------------- */

app.get("/api/words", (_, res) => {
    res.json({ words: getRandomWords(WORDS.easy, 3) });
});

app.post("/api/draw", async (req, res) => {
    if (!req.session.userId)
        return res.status(401).json({ error: "Не авторизован" });

    const { timeline, word } = req.body;
    if (!timeline || !word)
        return res.status(400).json({ error: "Нет данных" });

    const id = uuidv4();

    await pool.query(
        `INSERT INTO drawings (id, user_id, timeline, word)
         VALUES ($1, $2, $3, $4)`,
        [id, req.session.userId, JSON.stringify(timeline), word]
    );

    res.json({ success: true, id });
});

app.get("/api/my-drawings", async (req, res) => {
    if (!req.session.userId)
        return res.status(401).json({ error: "Не авторизован" });

    const { rows } = await pool.query(
        `SELECT id, word, created_at
         FROM drawings
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [req.session.userId]
    );

    res.json(rows);
});

app.get("/api/available-drawings", async (req, res) => {
    if (!req.session.userId)
        return res.status(401).json({ error: "Не авторизован" });

    try {
        const { rows } = await pool.query(
            `
            SELECT d.id, u.nickname
            FROM drawings d
            JOIN users u ON d.user_id = u.id
            WHERE d.user_id != $1
              AND NOT ($1 = ANY(CASE 
                                   WHEN d.guessed_by IS NULL THEN '{}'
                                   ELSE d.guessed_by
                                 END))
            ORDER BY d.created_at DESC
            `,
            [req.session.userId]
        );

        res.json(rows);
    } catch (err) {
        console.error("Ошибка при получении доступных рисунков:", err);
        res.status(500).json({ error: "Ошибка сервера" });
    }
});


app.get("/api/draw/:id", async (req, res) => {
    const userId = req.session.userId;

    const { rows } = await pool.query(
        "SELECT * FROM drawings WHERE id=$1",
        [req.params.id]
    );

    if (!rows.length)
        return res.status(404).json({ error: "Не найдено" });

    const drawing = rows[0];
    const response = { timeline: drawing.timeline };

    if (userId && drawing.user_id === userId) {
        response.word = drawing.word;
    }

    res.json(response);
});

app.post("/api/guess/:id", async (req, res) => {
    const userId = req.session.userId;
    const { guess } = req.body;

    if (!userId)
        return res.status(401).json({ error: "Не авторизован" });

    const { rows } = await pool.query(
        "SELECT * FROM drawings WHERE id=$1",
        [req.params.id]
    );

    if (!rows.length)
        return res.status(404).json({ error: "Не найдено" });

    const d = rows[0];

    if (d.user_id === userId)
        return res.status(403).json({ error: "Свой рисунок" });

    if (d.guessed_by.includes(userId))
        return res.status(403).json({ error: "Уже угадал" });

    const correct = d.word.toLowerCase() === guess.toLowerCase();

    if (correct) {
        await pool.query(
            "UPDATE drawings SET guessed_by = array_append(guessed_by, $1) WHERE id=$2",
            [userId, req.params.id]
        );

        await pool.query(
            "UPDATE users SET points = points + 1 WHERE id=$1",
            [userId]
        );

        await pool.query(
            "UPDATE users SET points = points + 1 WHERE id=$1",
            [d.user_id]
        );
    }

    res.json({ correct });
});

/* ---------------- Leaderboard ---------------- */

app.get("/leaderboard", async (_, res) => {
    const { rows } = await pool.query(
        "SELECT nickname, points FROM users ORDER BY points DESC LIMIT 10"
    );
    res.json(rows);
});

/* ---------------- Start ---------------- */

app.listen(PORT, () =>
    console.log(`🚀 Server running on port ${PORT}`)
);
