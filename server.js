const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// отдаём статические файлы
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("🎨 Draw Duel server is running!");
});

app.get("/draw", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});