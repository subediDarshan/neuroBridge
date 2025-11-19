import DailyData from '../models/DailyData.js';
import RealtimeData from '../models/RealtimeData.js';

export const getDailyDashboardData = async (req, res) => {
    try {
        // Get the start and end of the current day
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        // 1. Fetch Sleep Data from the 'daily_data' collection
        const sleepData = await DailyData.findOne({
            timestamp: { $gte: today, $lt: tomorrow }
        }).sort({ timestamp: -1 }); // Get the latest entry for today

        // 2. Aggregate Realtime Data (Heart Rate & Steps)
        const realtimeAggregates = await RealtimeData.aggregate([
            {
                $match: {
                    timestamp: { $gte: today, $lt: tomorrow }
                }
            },
            {
                $group: {
                    _id: null, // Group all documents for the day into one
                    avgHeartRate: { $avg: '$heart_rate' },
                    // Assuming 'steps' is a cumulative count for the day, we take the max value.
                    // If steps are incremental, you would use $sum instead.
                    totalSteps: { $max: '$steps' } 
                }
            }
        ]);
        
        const realtimeData = realtimeAggregates[0] || {}; // Handle case with no data

        // 3. Format the response to match the dashboard
        const dashboardData = {
            heartRate: Math.round(realtimeData.avgHeartRate) || 72, // Default value if no data
            bloodPressure: "120/80", // Placeholder - not in your schema
            sleep: {
                hours: sleepData ? Math.floor(sleepData.sleep.duration / 60) : 7,
                minutes: sleepData ? sleepData.sleep.duration % 60 : 30,
            },
            steps: realtimeData.totalSteps || 8547, // Default value if no data
        };

        res.status(200).json(dashboardData);

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ message: "Server error while fetching data." });
    }
};