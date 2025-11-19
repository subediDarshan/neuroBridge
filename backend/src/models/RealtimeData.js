

import mongoose from "mongoose";

const realtimeDataSchema = new mongoose.Schema({
    heart_rate: { type: Number, required: true },
    spo2: { type: Number },
    stress_level: { type: Number },
    steps: { type: Number },
    calories_burned: { type: Number },
    timestamp: { type: Date, required: true },
}, {
    timestamps: true,
    collection: "realtime_data"   // 🔥 important
});

// Default export
const RealtimeData = mongoose.model("RealtimeData", realtimeDataSchema);

export default RealtimeData;
