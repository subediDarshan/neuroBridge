import express from "express";
import RealtimeData from "../models/RealtimeData.js";


const router = express.Router();

// GET all realtime data
router.get("/", async (req, res) => {
    try {
        const data = await RealtimeData.find().sort({ createdAt: -1 });
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
router.get("/latest", async (req, res) => {
  try {
    const doc = await RealtimeData.findOne().sort({ timestamp: -1 });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
router.get("/aggregate", async (req, res) => {
  try {
    const { period = "weekly" } = req.query;

    // $dateTrunc available in MongoDB 5.0+. Fallback to $dateToString if needed.
    let unit;
    if (period === "weekly") unit = "week";
    else if (period === "monthly") unit = "month";
    else if (period === "quarterly") unit = "quarter";
    else unit = "month";

    const pipeline = [
      {
        $match: {
          timestamp: { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$timestamp",
              unit: unit
            }
          },
          avgHeartRate: { $avg: "$heart_rate" },
          avgStress: { $avg: "$stress_level" },
          totalSteps: { $sum: { $ifNull: ["$steps", 0] } },
          totalCaloriesBurned: { $sum: { $ifNull: ["$calories_burned", 0] } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } } // oldest -> newest
    ];

    const result = await RealtimeData.aggregate(pipeline);
    res.json({ success: true, data: result });
  } catch (err) {
    // If $dateTrunc is unsupported, send helpful message
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
