import express from "express";
import client from "../config.js"

const router = express.Router();

router.post("/send-sms", async (req, res) => {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
        return res.status(400).json({
            error: "Missing required parameters: phoneNumber or message"
        });
    }

    try {
        const sms = await client.messages.create({
            body: message,
            from: process.env.TWILIO_NUMBER,
            to: phoneNumber
        });

        console.log(`[SMS API] SMS sent to ${phoneNumber}. SID: ${sms.sid}`);

        res.json({
            success: true,
            message: "SMS sent successfully",
            sid: sms.sid
        });
    } catch (error) {
        console.error("[SMS API] Error sending SMS:", error);
        res.status(500).json({
            error: "Failed to send SMS",
            details: error.message
        });
    }
});


export default router;
