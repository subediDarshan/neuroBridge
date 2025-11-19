





import dotenv from "dotenv";
dotenv.config();
import express from "express";
import MONGODB from "./db/index.js";

import dailyRoutes from "./routes/daily.routes.js";
import realtimeRoutes from "./routes/realtime.routes.js";
import personalRoutes from "./routes/personal.routers.js";

import userRoutes from "./routes/user.routers.js";

import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// connect MongoDB
MONGODB();

// API Routes
app.use("/api/daily", dailyRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/personal", personalRoutes);
app.use("/api/user", userRoutes);

// Home Route
app.get("/", (req, res) => {
    res.send("API working!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
