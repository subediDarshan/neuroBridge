

import express from "express";
import DailyData from "../models/DailyData.js";

const router = express.Router();

// GET all daily data 
router.get("/", async (req, res) => {
    try {
        const data = await DailyData.find().sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
router.get("/latest", async (req, res) => {
  try {
    const doc = await DailyData.findOne().sort({ timestamp: -1 });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get("/aggregate", async (req, res) => {
  try {
    const { period = "monthly" } = req.query;
    let unit;
    if (period === "weekly") unit = "week";
    else if (period === "monthly") unit = "month";
    else if (period === "quarterly") unit = "quarter";
    else unit = "month";

    const pipeline = [
      { $match: { timestamp: { $exists: true } } },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$timestamp",
              unit: unit
            }
          },
          avgSleepDuration: { $avg: "$sleep.duration" },
          avgEnergy: { $avg: "$energy_score" },
          avgCalories: { $avg: "$nutrition.calories" },
          totalWater: { $sum: { $ifNull: ["$water_intake", 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const result = await DailyData.aggregate(pipeline);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err.message && err.message.includes("dateTrunc")) {
      return res.status(500).json({
        success: false,
        error:
          "$dateTrunc not supported on this MongoDB server. Use a newer MongoDB or update pipeline to use $dateToString fallback.",
      });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});


export default router;
