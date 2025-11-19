import mongoose from "mongoose";

const dailyDataSchema = new mongoose.Schema({
    sleep: {
        duration: { type: Number, required: true },
        quality: { type: String, enum: ["good", "average", "poor"], required: true },
        start: { type: Date, required: true },
        end: { type: Date, required: true }
    },
    nutrition: {
        calories: { type: Number, required: true },
        protein: { type: Number, required: true },
        carbs: { type: Number, required: true },
        fat: { type: Number, required: true }
    },
    water_intake: { type: Number, required: true },
    energy_score: { type: Number, required: true },
    timestamp: { type: Date, required: true },
}, { collection: "daily_data", timestamps: true });

export default mongoose.model("DailyData", dailyDataSchema);
