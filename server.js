const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("🎨 Draw Duel server is running!");
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
