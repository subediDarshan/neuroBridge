import express from "express";
const router = express.Router();
import client from "../config.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
import { getFamilySystemPrompt} from "../utils/prompts.js"

const familyConversations = {};
const callContext = {};

export async function initiatesFamilyCall(patientEmotionalState, familyNumber) {
    if (!familyNumber) {
        console.log("[Family Call] No family number provided, skipping family notification");
        return;
    }

    try {
        patientEmotionalState = "SEVERELY_DEPRESSED";

        console.log(`[Family Call] Initiating call to family member: ${familyNumber}`);
        const call = await client.calls.create({
            url: `${process.env.PUBLIC_URL}/family-voice`,
            from: process.env.TWILIO_NUMBER,
            to: familyNumber
        });

        console.log(`[Family Call] Family notification call initiated. SID: ${call.sid}, State: ${patientEmotionalState}`);

        if (!familyConversations[call.sid]) {
            familyConversations[call.sid] = {
                patientEmotionalState,
                conversation: []
            };
        }

        return call.sid;
    } catch (error) {
        console.error("[Family Call] Error initiating family call:", error);
    }
}

router.post("/family-voice", (req, res) => {
    const callSid = req.body.CallSid;
    console.log(`[Family Voice Webhook] Family call incoming. SID: ${callSid}`);

    if (!familyConversations[callSid]) {
        familyConversations[callSid] = {
            patientEmotionalState: "SEVERELY_DEPRESSED",
            conversation: []
        };
    }

    const patientState = familyConversations[callSid].patientEmotionalState;
    let urgencyMessage = "";

    if (patientState === "SEVERELY_DEPRESSED") {
        urgencyMessage = "This is an urgent call regarding your family member's mental health status.";
    } else if (patientState === "MILDLY_DEPRESSED") {
        urgencyMessage = "I'm calling with some concerns about your family member's current wellbeing.";
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="Polly.Joanna">
            Hello, this is Dr. Sarah, a licensed therapist. ${urgencyMessage} I just completed a wellness check with your family member and need to discuss my findings with you.
        </Say>
        <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-family-speech" method="POST">
            <Say voice="Polly.Joanna">Could you please tell me your relationship to the patient?</Say>
        </Gather>
        <Redirect>/family-voice-timeout</Redirect>
    </Response>`;

    res.type("text/xml").send(twiml);
});

router.post("/process-family-speech", express.urlencoded({ extended: false }), async (req, res) => {
    const speechResult = req.body.SpeechResult || "";
    const callSid = req.body.CallSid;

    console.log(`[Process Family Speech] Call: ${callSid}, Speech: "${speechResult}"`);

    if (!speechResult.trim()) {
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Polly.Joanna">I didn't catch that. Could you please tell me your relationship to the patient?</Say>
            <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-family-speech" method="POST"></Gather>
            <Redirect>/family-voice-timeout</Redirect>
        </Response>`;
        return res.type("text/xml").send(twiml);
    }

    try {
        if (!familyConversations[callSid]) {
            familyConversations[callSid] = {
                patientEmotionalState: "SEVERELY_DEPRESSED",
                conversation: []
            };
        }

        familyConversations[callSid].conversation.push({ role: "user", content: speechResult });
        const aiResponse = await getFamilyLLMResponse(
            familyConversations[callSid].conversation,
            callSid,
            familyConversations[callSid].patientEmotionalState
        );
        familyConversations[callSid].conversation.push({ role: "assistant", content: aiResponse });

        console.log(`[Process Family Speech] AI Response: "${aiResponse}"`);

        const conversationLength = familyConversations[callSid].conversation.length;

        if (conversationLength >= 8) {
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="Polly.Joanna">${aiResponse}</Say>
                <Say voice="Polly.Joanna">Thank you for taking the time to speak with me. Please follow up with the recommendations we discussed, and don't hesitate to contact professional services if you need immediate assistance. Goodbye.</Say>
                <Hangup/>
            </Response>`;

            delete familyConversations[callSid];
            return res.type("text/xml").send(twiml);
        }

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Polly.Joanna">${aiResponse}</Say>
            <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-family-speech" method="POST"></Gather>
            <Redirect>/family-voice-timeout</Redirect>
        </Response>`;

        res.type("text/xml").send(twiml);

    } catch (error) {
        console.error(`[Process Family Speech] Error:`, error);
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Polly.Joanna">I'm having trouble processing that. Let me try again - what is your relationship to the patient?</Say>
            <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-family-speech" method="POST"></Gather>
            <Redirect>/family-voice-timeout</Redirect>
        </Response>`;
        res.type("text/xml").send(twiml);
    }
});

router.post("/family-voice-timeout", (req, res) => {
    const callSid = req.body.CallSid;
    console.log(`[Family Voice Timeout] Family member didn't respond. Call: ${callSid}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="Polly.Joanna">I haven't heard from you. This is regarding your family member's mental health status. Please call back when you're available to discuss this important matter.</Say>
        <Hangup/>
    </Response>`;

    delete familyConversations[callSid];
    res.type("text/xml").send(twiml);
});

router.get("/family-call", async (req, res) => {
    const { familyNumber, patientName } = req.query;

    if (!familyNumber) {
        return res.status(400).json({
            error: "Missing familyNumber parameter"
        });
    }

    const testPatientName = patientName || "Patient";

    callContext.patientName = testPatientName;
    callContext.vitalsContext = { concernText: "elevated heart rate and low oxygen saturation" };
    callContext.familyNumber = familyNumber;
    callContext.status = "family_test";

    try {
        await initiatesFamilyCall("SEVERELY_DEPRESSED", familyNumber);

        res.json({
            success: true,
            familyNumber: familyNumber
        });
    } catch (error) {
        console.error("Family Call Error:", error);
        res.status(500).json({
            error: "Failed to initiate family test call",
            details: error.message
        });
    }
});

export function endCall(callSid) {
    console.log(`[${callSid}] Ending call...`);

    if (callContext && callContext.timer) {
        clearTimeout(callContext.timer);
    }

    if (callContext) {
        callContext.status = 'completed';
    }

    console.log(`[${callSid}] Call ended`);
}


export async function getFamilyLLMResponse(convo, callSid, patientEmotionalState) {
    console.log(`[${callSid}] Sending family notification prompt to LLM`);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
            getFamilySystemPrompt(
                callContext?.patientName || "the patient",
                patientEmotionalState,
                callContext?.vitalsContext?.concernText
            ),
            ...convo.map(msg => msg.content).join('\n')
        ]);

        const reply = result.response.text();
        console.log(`[${callSid}] Family LLM replied: ${reply}`);
        return reply;
    } catch (error) {
        console.error(`[${callSid}] Family LLM Error:`, error);
        return "I'm calling to discuss your family member's wellness check. Could you please repeat what you just said?";
    }
}

export default router;
