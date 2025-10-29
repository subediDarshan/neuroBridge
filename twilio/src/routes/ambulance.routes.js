import express from "express";
const app = express();
import client from "../config.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
import {getAmbulanceSystemPrompt} from "../utils/prompts.js"

const callContext = {};

export async function initiateAmbulanceCall(patientName, patientAddress, vitalsContext, emergencyDetails, ambulanceNumber) {
    if (!ambulanceNumber) {
        console.log("[Ambulance Call] No ambulance number provided, skipping ambulance call");
        return;
    }

    try {
        console.log(`[Ambulance Call] Initiating emergency call to: ${ambulanceNumber}`);
        const call = await client.calls.create({
            url: `${process.env.PUBLIC_URL}/ambulance-voice`,
            from: process.env.TWILIO_NUMBER,
            to: ambulanceNumber
        });

        console.log(`[Ambulance Call] Emergency ambulance call initiated. SID: ${call.sid}`);
        return call.sid;
    } catch (error) {
        console.error("[Ambulance Call] Error initiating ambulance call:", error);
    }
}

app.post("/ambulance-voice", async (req, res) => {
    const callSid = req.body.CallSid;
    console.log(`[Ambulance Voice Webhook] Emergency call incoming. SID: ${callSid}`);
    
    try {
        const emergencyMessage = await getAmbulanceLLMResponse(
            callContext?.patientName || "Patient",
            callContext?.patientAddress || process.env.PATIENT_ADDRESS || "Address not provided",
            callContext?.vitalsContext?.concernText || "critical vital signs detected",
            callContext?.emergencyDetails || "Patient monitoring system detected critical health emergency requiring immediate response"
        );

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Polly.Joanna">
                ${emergencyMessage}
            </Say>
            <Pause length="2"/>
            <Say voice="Polly.Joanna">
                Please confirm ambulance dispatch to this address. This is an automated emergency call from a patient monitoring system. Thank you.
            </Say>
            <Hangup/>
        </Response>`;

        console.log(`[Ambulance Voice Webhook] Emergency message delivered for call ${callSid}`);
        res.type("text/xml").send(twiml);
    } catch (error) {
        console.error(`[Ambulance Voice Webhook] Error:`, error);

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Polly.Joanna">
                This is Dr. Sarah calling for emergency medical services. We have a patient with critical vital signs requiring immediate ambulance dispatch. Patient monitoring system detected a medical emergency. Please send ambulance to the registered address immediately.
            </Say>
            <Hangup/>
        </Response>`;

        res.type("text/xml").send(twiml);
    }
});

app.get("/ambulance-call", async (req, res) => {
    const { ambulanceNumber, patientName, patientAddress, emergencyDetails } = req.query;

    if (!ambulanceNumber) {
        return res.status(400).json({
            error: "Missing ambulanceNumber parameter"
        });
    }

    const testPatientName = patientName || "Patient";
    const testPatientAddress = patientAddress || "123 Emergency Street, Test City";
    const testEmergencyDetails = emergencyDetails || "Patient monitoring system detected critical vital signs requiring immediate medical attention";

    callContext.patientName = testPatientName;
    callContext.patientAddress = testPatientAddress;
    callContext.emergencyDetails = testEmergencyDetails;
    callContext.vitalsContext = { concernText: "critical heart rate of 180 BPM and oxygen saturation below 85%" };

    try {
        await initiateAmbulanceCall(
            testPatientName,
            testPatientAddress,
            callContext.vitalsContext.concernText,
            testEmergencyDetails,
            ambulanceNumber
        );

        res.json({
            success: true,
            ambulanceNumber: ambulanceNumber,
        });
    } catch (error) {
        console.error("Ambulance Call Error:", error);
        res.status(500).json({
            error: "Failed to initiate ambulance test call",
            details: error.message
        });
    }
});


export async function getAmbulanceLLMResponse(patientName, patientAddress, vitalsContext, emergencyDetails) {
    console.log(`[Ambulance Call] Generating emergency dispatch message`);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
            getAmbulanceSystemPrompt(patientName, patientAddress, vitalsContext, emergencyDetails)
        ]);

        const reply = result.response.text();
        console.log(`[Ambulance Call] Emergency message generated: ${reply}`);
        return reply;
    } catch (error) {
        console.error(`[Ambulance Call] LLM Error:`, error);
        return `This is Dr. Sarah calling for emergency medical services. We have a patient at ${patientAddress || 'unknown address'} with critical vital signs requiring immediate ambulance dispatch. Patient name: ${patientName || 'Unknown'}. Critical condition detected by patient monitoring system.`;
    }
}
export default app;
