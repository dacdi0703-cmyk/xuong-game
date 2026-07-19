require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

require("./db"); // boots + seeds DB on import

const { router: authRouter } = require("./routes/auth");
const gamesRouter = require("./routes/games");
const usersRouter = require("./routes/users");
const friendsRouter = require("./routes/friends");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/games", gamesRouter);
app.use("/api/users", usersRouter);
app.use("/api/friends", friendsRouter);

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Xuong Game dang chay tai http://localhost:${PORT}`));
