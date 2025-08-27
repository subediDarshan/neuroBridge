import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from "@google/generative-ai";
import twilio from 'twilio';

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

let callContext = null;
let callResult = null;
const conversations = {};
const emotionalState = {};

function generateVitalsContext(vitals, alertType) {
    const { heart_rate, spo2, stress_level } = vitals;
    let concerns = [];
    if (alertType === "high_alert") {
        if (heart_rate > 110 || heart_rate < 50) concerns.push(`HR=${heart_rate}`);
        if (spo2 < 93) concerns.push(`SpO2=${spo2}%`);
        if (stress_level > 60) concerns.push(`Stress=${stress_level}`);
    }
    return { 
        concernText: concerns.join(" and ") || "vital sign changes", 
        severity: alertType === "high_alert" ? "severe" : "moderate" 
    };
}

const getSystemPrompt = (context, currentEmotionalState) => {
    const contextText = context?.vitalsContext?.concernText || "wellness check";
    return `You are Dr. Sarah, a licensed therapist working with a patient monitoring system. 
ALERT CONTEXT: 
- Specific Concerns: ${contextText}

CURRENT EMOTIONAL ASSESSMENT: ${currentEmotionalState || 'Initial assessment pending'}

THERAPEUTIC APPROACH:
- This is an emergency wellness check triggered by vital sign alerts
- Be professionally concerned but not alarmist
- Acknowledge the specific vital signs that triggered this call
- Assess if the vital changes correlate with emotional/psychological distress
- Use gentle probing to understand what might be causing these physiological changes
- Look for connections between physical symptoms and mental state

CONVERSATION STYLE:
- Start by explaining this is an automated wellness check due to concerning vitals
- Be specific about what the monitoring detected: "${contextText}"
- Ask about current activities, stressors, or events that might explain the vital changes
- Assess both physical comfort and emotional wellbeing
- If severe distress is detected, guide toward immediate care resources

Keep responses concise but thorough (2-3 sentences max per response).`;
};

async function getLLMResponse(convo, callSid) {
    console.log(`[${callSid}] Sending prompt to LLM with conversation history:`, convo);
    
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent([
            getSystemPrompt(callContext, emotionalState[callSid]),
            ...convo.map(msg => msg.content).join('\n')
        ]);
        
        const reply = result.response.text();
        console.log(`[${callSid}] LLM replied: ${reply}`);

        await updateEmotionalState(convo, callSid);
        console.log(`[${callSid}] Updated emotional state: ${emotionalState[callSid]}`);
        return reply;
    } catch (error) {
        console.error(`[${callSid}] LLM Error:`, error);
        return "I understand you're speaking with me. Could you please repeat what you just said?";
    }
}

async function updateEmotionalState(convo, callSid) {
    const lastUser = convo.filter(m => m.role === "user").pop();
    if (!lastUser) return;

    const prompt = `Given the user's response: "${lastUser.content}", 
Respond with ONLY one of these options:
SEVERELY_DEPRESSED
MILDLY_DEPRESSED  
NEUTRAL
POSITIVE`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(prompt);
        const state = result.response.text().trim();
        
        if (["SEVERELY_DEPRESSED", "MILDLY_DEPRESSED", "NEUTRAL", "POSITIVE"].includes(state)) {
            emotionalState[callSid] = state;
        } else {
            emotionalState[callSid] = "NEUTRAL";
        }
    } catch (error) {
        console.error(`[${callSid}] Emotional state update error:`, error);
        emotionalState[callSid] = "NEUTRAL";
    }
}

app.post("/start-therapeutic-call", express.json(), (req, res) => {
    const { vitalData, alertType, phoneNumber } = req.body;
    if (!vitalData || !alertType) return res.status(400).json({ error: "Missing fields" });

    const vitalsContext = generateVitalsContext(vitalData, alertType);
    callContext = { vitalData, alertType, vitalsContext, phoneNumber, status: 'initiated' };
    callResult = { status: 'initiated', outcome: null, finalState: null };

    console.log(`[Therapeutic Call Started] Vitals: ${JSON.stringify(vitalsContext)}, Phone: ${phoneNumber}`);
    res.json({ success: true, vitalsContext: vitalsContext.concernText });
});

app.post("/voice", (req, res) => {
    const callSid = req.body.CallSid;
    console.log(`[Twilio Voice Webhook] Call incoming. SID: ${callSid}`);
    
    if (!conversations[callSid]) {
        conversations[callSid] = [];
        emotionalState[callSid] = "NEUTRAL";
    }
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="Polly.Joanna">
            Hi, this is Dr. Sarah calling for a wellness check. How are you feeling right now?
        </Say>
        <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-speech" method="POST">
            <Say voice="Polly.Joanna">Please tell me how you're doing today.</Say>
        </Gather>
        <Redirect>/voice-timeout</Redirect>
    </Response>`;
    
    res.type("text/xml").send(twiml);
});

app.post("/process-speech", express.urlencoded({extended: false}), async (req, res) => {
    const speechResult = req.body.SpeechResult || "";
    const callSid = req.body.CallSid;
    
    console.log(`[Process Speech] Call: ${callSid}, Speech: "${speechResult}"`);
    
    if (!speechResult.trim()) {
        console.log(`[Process Speech] No speech detected, prompting again`);
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Polly.Joanna">I didn't catch that. Could you please tell me how you're feeling?</Say>
            <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-speech" method="POST">
            </Gather>
            <Redirect>/voice-timeout</Redirect>
        </Response>`;
        return res.type("text/xml").send(twiml);
    }
    
    try {
        if (!conversations[callSid]) {
            conversations[callSid] = [];
            emotionalState[callSid] = "NEUTRAL";
        }
        
        conversations[callSid].push({ role: "user", content: speechResult });
        const aiResponse = await getLLMResponse(conversations[callSid], callSid);
        conversations[callSid].push({ role: "assistant", content: aiResponse });
        
        console.log(`[Process Speech] AI Response: "${aiResponse}"`);
        
        const conversationLength = conversations[callSid].length;
        
        if (/\b(i am|i'm|im)\s+(ok|okay|fine|good|alright|well|better)\b/i.test(speechResult) || conversationLength >= 12) {
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="Polly.Joanna">${aiResponse}</Say>
                <Say voice="Polly.Joanna">I'm glad we could talk today. Please take care of yourself, and don't hesitate to reach out if you need support. Goodbye!</Say>
                <Hangup/>
            </Response>`;
            
            endCall(callSid);
            return res.type("text/xml").send(twiml);
        }
        
        if (emotionalState[callSid] === "SEVERELY_DEPRESSED" || 
            /\b(hurt|harm|suicide|kill|die|end it all)\b/i.test(speechResult)) {
            
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Say voice="Polly.Joanna">${aiResponse}</Say>
                <Say voice="Polly.Joanna">I'm concerned about what you've shared. Please consider calling 988, the Suicide and Crisis Lifeline, or go to your nearest emergency room. You don't have to go through this alone.</Say>
                <Hangup/>
            </Response>`;
            
            endCall(callSid);
            return res.type("text/xml").send(twiml);
        }
        
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Polly.Joanna">${aiResponse}</Say>
            <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-speech" method="POST">
            </Gather>
            <Redirect>/voice-timeout</Redirect>
        </Response>`;
        
        res.type("text/xml").send(twiml);
        
    } catch (error) {
        console.error(`[Process Speech] Error:`, error);
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
            <Say voice="Polly.Joanna">I'm having trouble processing that. Let me try again - how are you feeling today?</Say>
            <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-speech" method="POST">
            </Gather>
            <Redirect>/voice-timeout</Redirect>
        </Response>`;
        res.type("text/xml").send(twiml);
    }
});

app.post("/voice-timeout", (req, res) => {
    const callSid = req.body.CallSid;
    console.log(`[Voice Timeout] User didn't respond. Call: ${callSid}`);
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
        <Say voice="Polly.Joanna">I haven't heard from you in a while. Are you still there?</Say>
        <Gather input="speech" timeout="10" speechTimeout="auto" language="en-US" action="/process-speech" method="POST">
            <Say voice="Polly.Joanna">Please let me know if you're okay.</Say>
        </Gather>
        <Say voice="Polly.Joanna">I'll check back with you later. Please take care of yourself, and remember that support is available if you need it.</Say>
        <Hangup/>
    </Response>`;
    
    if (callSid) {
        endCall(callSid);
    }
    
    res.type("text/xml").send(twiml);
});

app.get("/trigger-call", async (req, res) => {
    try {
        const call = await client.calls.create({
            url: `${process.env.PUBLIC_URL}/voice`,
            from: process.env.TWILIO_NUMBER,
            to: process.env.USER_NUMBER
        });
        console.log(`[Trigger Call] Call initiated. SID: ${call.sid}`);
        res.send(`Call started! SID: ${call.sid}`);
    } catch (err) {
        console.error(`[Trigger Call Error]`, err);
        res.status(500).send("Failed to initiate call");
    }
});

function endCall(callSid) {
    console.log(`[${callSid}] Ending call...`);
    
    if (callContext && callContext.timer) {
        clearTimeout(callContext.timer);
    }

    const finalState = emotionalState[callSid] || "NEUTRAL";
    callResult = { 
        status: 'completed', 
        outcome: finalState, 
        finalState,
        timestamp: new Date().toISOString(),
        conversationLength: conversations[callSid] ? conversations[callSid].length : 0
    };

    delete conversations[callSid];
    delete emotionalState[callSid];
    
    if (callContext) {
        callContext.status = 'completed';
    }

    console.log(`[${callSid}] Call ended with outcome: ${finalState}`);
}

app.get("/health", (req, res) => {
    res.json({ 
        status: "healthy", 
        callResult,
        activeConversations: Object.keys(conversations).length,
        callContext: callContext ? { status: callContext.status } : null,
        timestamp: new Date().toISOString()
    });
});

app.get("/debug", (req, res) => {
    res.json({
        conversations: conversations,
        emotionalState: emotionalState,
        callContext: callContext,
        callResult: callResult,
        environment: {
            PUBLIC_URL: process.env.PUBLIC_URL,
            TWILIO_NUMBER: process.env.TWILIO_NUMBER,
            USER_NUMBER: process.env.USER_NUMBER,
            GEMINI_API_KEY: process.env.GEMINI_API_KEY ? 'Set' : 'Not Set',
            TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Not Set',
            TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Not Set'
        }
    });
});

app.get("/test-vital-alert", (req, res) => {
    const testVitalData = {
        heart_rate: 120,
        spo2: 88,
        stress_level: 75
    };
    
    const vitalsContext = generateVitalsContext(testVitalData, "high_alert");
    callContext = { 
        vitalData: testVitalData, 
        alertType: "high_alert", 
        vitalsContext, 
        phoneNumber: process.env.USER_NUMBER, 
        status: 'initiated' 
    };
    callResult = { status: 'initiated', outcome: null, finalState: null };

    res.json({ 
        message: "Test vital alert set", 
        vitalsContext: vitalsContext.concernText,
        callContext: callContext
    });
});

app.post("/trigger-therapeutic-call", express.json(), async (req, res) => {
    const { phoneNumber } = req.body;
    const targetNumber = phoneNumber || process.env.USER_NUMBER;
    
    if (!targetNumber) {
        return res.status(400).json({ error: "No phone number provided" });
    }
    
    try {
        const call = await client.calls.create({
            url: `${process.env.PUBLIC_URL}/voice`,
            from: process.env.TWILIO_NUMBER,
            to: targetNumber
        });
        
        console.log(`[Trigger Therapeutic Call] Call initiated to ${targetNumber}. SID: ${call.sid}`);
        res.json({ 
            success: true, 
            callSid: call.sid, 
            phoneNumber: targetNumber,
            message: "Therapeutic call initiated"
        });
    } catch (err) {
        console.error(`[Trigger Therapeutic Call Error]`, err);
        res.status(500).json({ error: "Failed to initiate call", details: err.message });
    }
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Twilio voice webhook ready at /voice`);
    console.log(`Environment check:`);
    console.log(`- PUBLIC_URL: ${process.env.PUBLIC_URL}`);
    console.log(`- TWILIO_NUMBER: ${process.env.TWILIO_NUMBER}`);
    console.log(`- USER_NUMBER: ${process.env.USER_NUMBER}`);
    console.log(`- GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Set' : 'Not Set'}`);
    console.log(`- TWILIO_ACCOUNT_SID: ${process.env.TWILIO_ACCOUNT_SID ? 'Set' : 'Not Set'}`);
    console.log(`- TWILIO_AUTH_TOKEN: ${process.env.TWILIO_AUTH_TOKEN ? 'Set' : 'Not Set'}`);
});