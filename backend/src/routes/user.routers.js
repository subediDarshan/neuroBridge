


import express from "express";
import { User } from "../models/user.js";

const router = express.Router();

/* --------- CLEAN EMAIL HELPER --------- */
function cleanEmail(email) {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/* --------- GET ALL USERS --------- */
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-password -refreshToken");
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* --------- CREATE USER (for testing) --------- */
router.post("/", async (req, res) => {
  try {
    let { username, emailId, password } = req.body;

    // CLEAN EMAIL BEFORE SAVING
    emailId = cleanEmail(emailId);

    const user = await User.create({ username, emailId, password });
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* --------- GET LOGGED-IN USER --------- */
router.get("/me", async (req, res) => {
  try {
    let { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error("USER /me ERROR:", err);
    res.status(500).json({ success: false, message: "Server error", error: err });
  }
});

export default router;
