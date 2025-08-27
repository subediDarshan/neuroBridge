import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

const app = express();

app.use(
    cors({
        origin: "*",
        credentials: true,
    })
);

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" },
});

app.use(express.json());

let overrideData = null;

// --- Incremental counters ---
let stepCount = 0;
let calorieCount = 0;

// Utility
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- REALTIME DATA ----
function generateRealtimeData() {
    if (overrideData) return overrideData;

    // Incremental updates
    stepCount += random(5, 20); // steps increase gradually
    calorieCount += random(1, 5); // calories burned

    return {
        heart_rate: random(60, 100),
        spo2: random(95, 100),
        stress_level: random(1, 5),
        steps: stepCount,
        calories_burned: calorieCount,
        timestamp: Date.now(),
    };
}

// ---- DAILY DATA ----
function generateDailyData() {
    return {
        sleep: {
            duration: random(300, 500), // minutes slept
            quality: ["good", "average", "poor"][random(0, 2)],
            start: Date.now() - 8 * 60 * 60 * 1000,
            end: Date.now(),
        },
        nutrition: {
            calories: random(1500, 2500),
            protein: random(40, 100),
            carbs: random(150, 300),
            fat: random(40, 90),
        },
        water_intake: (Math.random() * 3).toFixed(1), // liters
        goals: {
            step_goal: 10000,
            calorie_goal: 2500,
            sleep_goal: 480,
            water_goal: 2.5,
        },
        energy_score: random(50, 95),
        timestamp: Date.now(),
    };
}

// WebSocket (Socket.IO) connection
io.on("connection", (socket) => {
    console.log("📡 Client connected:", socket.id);

    // Realtime stream (every 5s)
    const realtimeInterval = setInterval(() => {
        socket.emit("realtimeData", generateRealtimeData());
    }, 5000);

    // Daily stream (every 60s in demo mode)
    const dailyInterval = setInterval(() => {
        socket.emit("dailyData", generateDailyData());
    }, 60000);

    socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
        clearInterval(realtimeInterval);
        clearInterval(dailyInterval);
    });
});

// Override API
app.post("/override", (req, res) => {
    const { heart_rate, spo2, stress_level } = req.body;

    overrideData = {
        heart_rate: heart_rate ?? random(60, 100),
        spo2: spo2 ?? random(95, 100),
        stress_level: stress_level ?? random(1, 5),
        steps: stepCount,
        calories_burned: calorieCount,
        timestamp: Date.now(),
    };

    io.emit("overrideSet", overrideData);
    res.json({ status: "override set", data: overrideData });
});

// Reset API
app.post("/reset", (req, res) => {
    overrideData = null;
    io.emit("overrideCleared");
    res.json({ status: "override cleared" });
});

// Start server
server.listen(3000, () => {
    console.log("🚀 Server running on http://localhost:3000");
});



