

import express from "express";
import { Personal } from "../models/Personal.js";

const router = express.Router();

/* --------- CLEAN EMAIL HELPER --------- */
function cleanEmail(email) {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/* --------- GET ALL PERSONAL RECORDS --------- */
router.get("/", async (req, res) => {
  try {
    const personal = await Personal.find();
    res.json({ success: true, personal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* --------- CREATE PERSONAL RECORD --------- */
router.post("/", async (req, res) => {
  try {
    let body = req.body;

    // CLEAN emailId field if present
    if (body.emailId) {
      body.emailId = cleanEmail(body.emailId);
    }

    const personal = await Personal.create(body);
    res.json({ success: true, personal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* --------- GET LOGGED-IN USER PERSONAL DETAILS --------- */
router.get("/me", async (req, res) => {
  try {
    let { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    const personal = await Personal.findOne({ userId });

    if (!personal) {
      return res.status(404).json({ success: false, message: "Personal details not found" });
    }

    res.json({ success: true, data: personal });
  } catch (err) {
    console.error("Personal.me error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err });
  }
});


export default router;
