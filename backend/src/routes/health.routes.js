import express from 'express';
import { getDailyDashboardData } from '../controllers/healthController.js';

const router = express.Router();

// @route   GET /api/dashboard/daily
// @desc    Get aggregated data for the daily dashboard view
// @access  Public (you can add authentication middleware later)
router.get('/dashboard/daily', getDailyDashboardData);

export default router;