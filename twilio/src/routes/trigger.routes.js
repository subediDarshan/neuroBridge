
import express from "express";
const router = express.Router();
import client from "../config.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
import { getSystemPrompt, generateSummaryPrompt } from "../utils/prompts.js";

const conversations = {};
const emotionalState = {}; // optional cache (final emotion stored here after generation)
const callResults = {};
const summaries = {};

// Per-call promise chain to serialize LLM requests
const llmChains = {};

/* ---------- Helpers ---------- */

function enqueueLLMTask(callSid, taskFn) {
  if (!callSid) return taskFn();
  const prev = llmChains[callSid] || Promise.resolve();
  const next = prev.catch(() => {}).then(taskFn);
  llmChains[callSid] = next;
  return next;
}

async function callGenerativeModelWithRetry(partsArray, maxRetries = 3) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const contentParts = Array.isArray(partsArray) ? partsArray : [String(partsArray)];
  let attempt = 0;
  let wait = 500;

  while (attempt <= maxRetries) {
    try {
      const result = await model.generateContent(contentParts);
      return result;
    } catch (err) {
      attempt++;
      const status = err?.status || err?.response?.status || err?.statusCode;
      console.warn(`[LLM Retry] attempt ${attempt}, status=${status}`, err?.message || err);
      if ((status === 429 || status === 503) && attempt <= maxRetries) {
        await new Promise(r => setTimeout(r, wait));
        wait *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error("LLM retries exhausted");
}

/* ---------- LLM wrappers (single-purpose) ---------- */

/**
 * getLLMReply:
 * - Single LLM call during the call flow.
 * - Returns plain assistant reply text.
 */
export async function getLLMReply(convo, callSid) {
  const safeConvo = Array.isArray(convo) ? convo : [];
  const convoText = safeConvo.map(msg => `${msg.role}: ${msg.content}`).join("\n");

  const systemPrompt = getSystemPrompt(callSid ? { callSid } : {}, emotionalState[callSid]) || "";

  const instruction = `
You are "Dr. Anaya". Produce a short, empathetic assistant reply (1-2 sentences) appropriate for a voice call.
Output: plain text only (no JSON, no markdown).
`;

  const parts = [systemPrompt, convoText, instruction];

  return enqueueLLMTask(callSid, async () => {
    try {
      const res = await callGenerativeModelWithRetry(parts, 2);
      const text = res?.response?.text?.() ?? "";
      return text.trim() || "I'm sorry — could you say that again?";
    } catch (err) {
      console.error(`[${callSid}] getLLMReply error:`, err?.message || err);
      return "I'm having trouble at the moment. Could you repeat that?";
    }
  });
}

/**
 * generateSummary:
 * - Uses full conversation to create a human-readable summary.
 * - Returns summary string.
 */
export async function generateSummary(callSid) {
  const convo = conversations[callSid];
  if (!callSid || !Array.isArray(convo) || convo.length === 0) {
    console.error(`[generateSummary] No conversation for ${callSid}`);
    return "No conversation data available for this call.";
  }

  const convoText = convo.map(m => `${m.role}: ${m.content}`).join("\n");
  const promptStr = generateSummaryPrompt(convoText);
  const systemPrompt = getSystemPrompt({ callSid }, emotionalState[callSid]) || "";
  const parts = [systemPrompt, promptStr];

  try {
    const result = await enqueueLLMTask(callSid, async () => {
      const r = await callGenerativeModelWithRetry(parts, 3);
      return r;
    });

    const summaryText = result?.response?.text?.() ?? "Summary generation failed.";
    summaries[callSid] = summaryText;
    // persist in callResults
    callResults[callSid] = callResults[callSid] || {};
    callResults[callSid].summary = summaryText;
    callResults[callSid].summaryGenerated = true;
    callResults[callSid].summaryGeneratedAt = new Date().toISOString();
    return summaryText;
  } catch (err) {
    console.error(`[${callSid}] generateSummary error:`, err?.message || err);
    return "Failed to generate conversation summary.";
  }
}

/**
 * generateFinalEmotion:
 * - Analyze whole conversation and return one of the 4 labels.
 */
export async function generateFinalEmotion(callSid) {
  const convo = conversations[callSid];
  if (!callSid || !Array.isArray(convo) || convo.length === 0) {
    console.error(`[generateFinalEmotion] No conversation for ${callSid}`);
    return "NEUTRAL";
  }

  const convoText = convo.map(m => `${m.role}: ${m.content}`).join("\n");
  const systemPrompt = getSystemPrompt({ callSid }, null) || "";

  const instruction = `
Analyze the full conversation below and respond with ONLY one of:
SEVERELY_DEPRESSED
MILDLY_DEPRESSED
NEUTRAL
POSITIVE

Do NOT output anything else.
Conversation:
${convoText}
`;

  const parts = [systemPrompt, instruction];

  try {
    const result = await enqueueLLMTask(callSid, async () => {
      const r = await callGenerativeModelWithRetry(parts, 3);
      return r;
    });

    let raw = result?.response?.text?.() ?? "";
    raw = raw.trim();
    // Model might return with extra punctuation/newlines; sanitize
    const candidate = raw.split(/\s|[\r\n]+/).find(w =>
      ["SEVERELY_DEPRESSED", "MILDLY_DEPRESSED", "NEUTRAL", "POSITIVE"].includes(w)
    );

    const emotion = candidate || "NEUTRAL";
    emotionalState[callSid] = emotion;
    // persist to callResults
    callResults[callSid] = callResults[callSid] || {};
    callResults[callSid].emotion = emotion;
    callResults[callSid].emotionGeneratedAt = new Date().toISOString();
    return emotion;
  } catch (err) {
    console.error(`[${callSid}] generateFinalEmotion error:`, err?.message || err);
    emotionalState[callSid] = emotionalState[callSid] || "NEUTRAL";
    return emotionalState[callSid];
  }
}

/* ---------- Routes ---------- */

/**
 * Trigger call (unchanged)
 */
router.get("/trigger-call", async (req, res) => {
  try {
    const call = await client.calls.create({
      url: `${process.env.PUBLIC_URL}/voice`,
      from: process.env.TWILIO_NUMBER,
      to: process.env.USER_NUMBER,
      statusCallback: `${process.env.PUBLIC_URL}/call-status`,
      statusCallbackEvent: ["completed"],
    });
    res.json({ sid: call.sid });
  } catch (err) {
    console.error("Trigger Call Error", err);
    res.status(500).send("Failed to initiate call");
  }
});

/**
 * Twilio voice webhook to start a call
 */
router.post("/voice", (req, res) => {
  const callSid = req.body.CallSid;
  console.log(`[voice] incoming call: ${callSid}`);
  if (!conversations[callSid]) {
    conversations[callSid] = [];
  }
  // initial prompt
  res.type("text/xml").send(`
    <Response>
      <Say voice="Polly.Joanna">Hi, this is Dr. Anaya. How are you feeling?</Say>
      <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-speech" method="POST"/>
    </Response>`);
});

/**
 * process-speech:
 * - Save user text
 * - Call getLLMReply (single LLM call)
 * - Save assistant reply
 * - Optionally end call on keywords or length
 */
router.post("/process-speech", express.urlencoded({ extended: false }), async (req, res) => {
  const speechResult = (req.body.SpeechResult || "").trim();
  const callSid = req.body.CallSid;
  console.log(`[process-speech] ${callSid} -> "${speechResult}"`);

  if (!speechResult) {
    return res.type("text/xml").send(`
      <Response>
        <Say voice="Polly.Joanna">I didn't catch that. Could you please tell me how you're feeling?</Say>
        <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-speech" method="POST"/>
      </Response>`);
  }

  try {
    if (!conversations[callSid]) {
      conversations[callSid] = [];
    }

    conversations[callSid].push({ role: "user", content: speechResult });

    // single LLM call for reply only
    const reply = await getLLMReply(conversations[callSid], callSid);

    conversations[callSid].push({ role: "assistant", content: reply });

    // If user says they're fine/ok or conversation too long -> end call
    if (/\b(i am|i'm|im)\s+(ok|fine|good|alright)\b/i.test(speechResult) || conversations[callSid].length >= 24) {
      // mark call as ended (no summary/emotion generated here)
      callResults[callSid] = callResults[callSid] || {};
      callResults[callSid].completed = true;
      callResults[callSid].timestamp = new Date().toISOString();
      callResults[callSid].conversationLength = conversations[callSid].length;
      return res.type("text/xml").send(`
        <Response>
          <Say voice="Polly.Joanna">${reply}</Say>
          <Say voice="Polly.Joanna">Take care. Goodbye!</Say>
          <Hangup/>
        </Response>`);
    }

    // continue conversation
    return res.type("text/xml").send(`
      <Response>
        <Say voice="Polly.Joanna">${reply}</Say>
        <Gather input="speech" timeout="15" speechTimeout="auto" language="en-US" action="/process-speech" method="POST"/>
      </Response>`);
  } catch (err) {
    console.error(`[process-speech] error for ${callSid}:`, err?.message || err);
    return res.type("text/xml").send(`
      <Response>
        <Say voice="Polly.Joanna">I'm having trouble processing that. Please try again.</Say>
      </Response>`);
  }
});

/**
 * call-status: Twilio posts when call completes. We mark call completed but DO NOT auto-generate summary/emotion.
 */
router.post("/call-status", async (req, res) => {
  const callSid = req.body.CallSid;
  console.log(`[call-status] completed: ${callSid}`);

  // wait for ongoing LLM tasks to finish (if any)
  if (llmChains[callSid]) {
    try {
      await llmChains[callSid];
    } catch (err) {
      console.warn(`[call-status] waiting chain error for ${callSid}:`, err?.message || err);
    }
  }

  callResults[callSid] = callResults[callSid] || {};
  callResults[callSid].completed = true;
  callResults[callSid].timestamp = new Date().toISOString();
  callResults[callSid].conversationLength = conversations[callSid]?.length || 0;

  console.log(`[call-status] marked completed for ${callSid}`);
  res.status(200).send("OK");
});

/**
 * GET /get-emotion/:callSid
 * Returns final emotion if already generated, or status.
 */
router.get("/get-emotion/:callSid", (req, res) => {
  const callSid = req.params.callSid;
  const result = callResults[callSid];
  if (!result) return res.status(404).json({ error: "Call not found" });

  if (!result.completed) return res.json({ status: "in-progress" });

  res.json({
    status: "completed",
    emotion: result.emotion || null,
    summaryAvailable: !!result.summary,
    summaryGenerated: !!result.summaryGenerated,
    conversationLength: result.conversationLength || 0
  });
});

/**
 * POST /generate-summary/:callSid
 * Manually generate summary for a completed call (or automatic trigger later).
 */
router.post("/generate-summary/:callSid", async (req, res) => {
  const callSid = req.params.callSid;
  const result = callResults[callSid];
  if (!result) return res.status(404).json({ error: "Call not found", callSid });

  if (!result.completed) return res.status(400).json({ error: "Call not yet completed", status: result.status || "in-progress" });

  const convo = conversations[callSid];
  if (!convo || convo.length === 0) return res.status(400).json({ error: "No conversation data available for this call" });

  if (result.summaryGenerated && result.summary) {
    return res.json({ success: true, message: "Summary already generated", summary: result.summary, cached: true });
  }

  try {
    const summary = await generateSummary(callSid);
    return res.json({ success: true, summary, callSid, cached: false });
  } catch (err) {
    console.error(`[generate-summary] error ${callSid}:`, err?.message || err);
    return res.status(500).json({ error: "Failed to generate summary", details: err?.message });
  }
});

/**
 * POST /generate-final-emotion/:callSid
 * Manually generate final emotion for the full conversation.
 */
router.post("/generate-final-emotion/:callSid", async (req, res) => {
  const callSid = req.params.callSid;
  const result = callResults[callSid];
  if (!result) return res.status(404).json({ error: "Call not found", callSid });

  if (!result.completed) return res.status(400).json({ error: "Call not yet completed", status: result.status || "in-progress" });

  try {
    // If already generated, return cached
    if (result.emotion) {
      return res.json({ success: true, emotion: result.emotion, cached: true });
    }

    const emotion = await generateFinalEmotion(callSid);
    // persist
    callResults[callSid].emotion = emotion;
    return res.json({ success: true, emotion, callSid, cached: false });
  } catch (err) {
    console.error(`[generate-final-emotion] error ${callSid}:`, err?.message || err);
    return res.status(500).json({ error: "Failed to generate final emotion", details: err?.message });
  }
});
export { callResults };
export default router;
