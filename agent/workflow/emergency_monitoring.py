from langgraph.graph import StateGraph, END
from typing import TypedDict
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from config.db import realtime_data_collection, call_sms_history_collection
from pymongo import DESCENDING
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate
from datetime import datetime, timedelta, timezone
from utils.spam_avoidance import cooled_off
from models.call_sms_history import call_sms_history
import requests
import time

load_dotenv()

model = init_chat_model(model="gemini-2.0-flash", model_provider="google_genai")




# ---- STATE ----
class State(TypedDict):
    data: dict
    status: str
    decision: str
    alert_sent: bool
    sms_message: str
    therapist_conclusion: str
    sid: str


# ---- NODES ----
def take_data(state: State):
    return {"status": "data_collected"}

def hardcoded_checks(state: State):
    data = state["data"]
    heart_rate, spo2, stress = data.get("heart_rate"), data.get("spo2"), data.get("stress_level")

    status_list = []

    # check heart rate
    if 60 <= heart_rate <= 100:
        status_list.append("Normal")
    elif 50 <= heart_rate <= 59 or 101 <= heart_rate <= 110:
        status_list.append("Low Alert")
    else:
        status_list.append("High Alert")

    # check SpO2
    if 95 <= spo2 <= 100:
        status_list.append("Normal")
    elif 93 <= spo2 <= 94:
        status_list.append("Low Alert")
    else:
        status_list.append("High Alert")

    # check stress level
    if 0 <= stress <= 40:
        status_list.append("Normal")
    elif 41 <= stress <= 60:
        status_list.append("Low Alert")


    # determine final status
    if "High Alert" in status_list:
        final_status = "high_alert"
    elif "Low Alert" in status_list:
        final_status = "small_alert"
    else:
        final_status = "normal"

    if(
        (final_status == "high_alert" and not(cooled_off("emergency_call")))
        or
        (final_status == "small_alert" and not(cooled_off("emergency_sms")))
    ):
        final_status = "normal"
    
    if(final_status == "normal" and stress > 60 and cooled_off("therapist_call")):
        final_status = "high_stress"
    
    return {"decision": final_status}


def pass_to_llm(state: State):
    data = state["data"]

    # Calculate 5 minutes ago
    five_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=5)

    # Query records from last 5 minutes
    recent_data = list(
        realtime_data_collection.find(
            {"timestamp": {"$gte": five_minutes_ago}}
        ).sort("timestamp", DESCENDING)
    )

    # Calculate averages
    if recent_data:
        avg_hr = sum(record["heart_rate"] for record in recent_data) / len(recent_data)
        avg_spo2 = sum(record["spo2"] for record in recent_data) / len(recent_data)
        avg_stress_level = sum(record["stress_level"] for record in recent_data) / len(recent_data)
    else:
        avg_hr = avg_spo2 = avg_stress_level = None  # Handle case where no data is available


    data.update({
        "avg_hr": avg_hr,
        "avg_spo2": avg_spo2,
        "avg_stress_level": avg_stress_level
    })
    

    class SmsMessage(BaseModel):
        message: str = Field(description='Short SMS alert message for the patient')


    parser = PydanticOutputParser(pydantic_object=SmsMessage)

    template = PromptTemplate(
        template="""
        You are an AI health assistant monitoring patient vitals.
        You received new data that triggered a small alert.

        Patient Data:
        - Heart Rate: {heart_rate} bpm
        - SpO2: {spo2} %
        - Stress Level: {stress_level}
        - Average HR (last 5 min): {avg_hr} bpm
        - Average SpO2 (last 5 min): {avg_spo2} %
        - Average Stress Level (last 5 min): {avg_stress_level}
        - Timestamp: {timestamp}

        Task:
        Write a short SMS alert message for the patient.  
        Guidelines:
        - Be concise (max 2 sentences, under 200 characters).  
        - Mention what was detected (e.g., "slightly high heart rate").  
        - Suggest a simple, calm next step (e.g., "rest for a few minutes and hydrate").  
        - Do NOT sound alarming unless it's clearly critical.  
        - Avoid medical jargon.  
        - Return ONLY the SMS text, nothing else.


        {format_instruction}
        """,
        input_variables=["heart_rate", "spo2", "stress_level", "avg_hr", "avg_spo2", "avg_stress_level", "timestamp"],
        partial_variables={'format_instruction':parser.get_format_instructions()}
    )

    chain = template | model | parser
    final_result = chain.invoke(data)

    return {"sms_message": final_result.message}


def sms_alert(state: State):
    print("Sending SMS alert...")

    validated_data = call_sms_history(type = "emergency_sms", timestamp = datetime.now(timezone.utc))
    call_sms_history_collection.insert_one(validated_data.model_dump())


    sms_message = state.get("sms_message")
    print(f"SMS: {sms_message}")
    # Twilio Integration for SMS
    payload = {
        "phoneNumber": "+917014664028",
        "message": sms_message
    }
    response = requests.post("https://twillio-testing-2.onrender.com/send-sms", json=payload)
    print("Status Code: ", response.status_code)
    return {"alert_sent": True}


def emergency_call(state: State):
    print("Emergency Call triggered!")

    validated_data = call_sms_history(type = "emergency_call", timestamp = datetime.now(timezone.utc))
    call_sms_history_collection.insert_one(validated_data.model_dump())

    emergency_context = state["data"]

    class SummarizedText(BaseModel):
        summary: str = Field(description='Short summary message of the patients vitals')


    parser = PydanticOutputParser(pydantic_object=SummarizedText)

    template = PromptTemplate(
        template="""
        You are an AI health assistant monitoring patient vitals.
        You received new data that triggered a emergency alert.
        
        Patient Data:
        - Heart Rate: {heart_rate} bpm
        - SpO2: {spo2} %
        - Stress Level: {stress_level}
        - Timestamp: {timestamp}

        Task:
        You need to just summarize this data in very short words explaining what happened to patient.  
        Guidelines:
        - Be concise (under 500 characters).  
        - Mention what was detected (e.g., "high heart rate").   
        - Return ONLY the summarized text, nothing else.

        {format_instruction}
        """,
        input_variables=["heart_rate", "spo2", "stress_level", "timestamp"],
        partial_variables={'format_instruction':parser.get_format_instructions()}
    )

    chain = template | model | parser
    final_result = chain.invoke(emergency_context)

    final_context = final_result.summary

    print("This is the emergency context: ", final_context)

    # Twilio integration for call
    requests.get("https://twillio-testing-2.onrender.com/ambulance-call", params={"ambulanceNumber": "+917014664028", "patientName": "Priyansh", "patientAddress": "Patiala", "emergencyDetails": final_context})


    return {"decision": "called emergency contact"}


def family_call(state: State):
    print("Family Call triggered!")

    validated_data = call_sms_history(type = "family_call", timestamp = datetime.now(timezone.utc))
    call_sms_history_collection.insert_one(validated_data.model_dump())

    sid = state["sid"]

    res = requests.post("https://twillio-testing-2.onrender.com/family-call", json={"therapistCallSid": sid, "familyNumber": "+917014664028"})

    # Twilio integration for call
    return {"decision": "called family contact"}


def therapist_call(state: State):
    print("Therapist Call triggered!")

    validated_data = call_sms_history(type = "therapist_call", timestamp = datetime.now(timezone.utc))
    call_sms_history_collection.insert_one(validated_data.model_dump())


    # Twilio integration for call
    res = requests.get("https://twillio-testing-2.onrender.com/trigger-call")

    data = res.json()        
    sid = data.get("sid")

    while True:
        try:
            res = requests.get(f"https://twillio-testing-2.onrender.com/get-emotion/{sid}")
            data = res.json()

            if "error" in data:
                print("Call ongoing")
                time.sleep(5)
                continue
            
            print("Call Completed!")
            break

        except Exception as e:
            print("Request failed:", e)
            time.sleep(5)

    res = requests.post(f"https://twillio-testing-2.onrender.com/generate-final-emotion/{sid}")
    data = res.json()
    emotion = data.get("emotion")
    print("Emotion:", emotion)

    if ("DEPRESSED" in emotion) or ("depressed" in emotion) :
        res = requests.post(f"https://twillio-testing-2.onrender.com/generate-summary/{sid}")
        return {"decision": "escalate", "sid": sid}

    return {"decision": "normal"}


# ---- GRAPH ----
graph = StateGraph(State)

graph.add_node("take_data", take_data)
graph.add_node("hardcoded_checks", hardcoded_checks)
graph.add_node("pass_to_llm", pass_to_llm)
graph.add_node("sms_alert", sms_alert)
graph.add_node("emergency_call", emergency_call)
graph.add_node("therapist_call", therapist_call)
graph.add_node("family_call", family_call)

graph.set_entry_point("take_data")

# ---- EDGES ----
graph.add_edge("take_data", "hardcoded_checks")

# Branching from hardcoded checks
graph.add_conditional_edges(
    "hardcoded_checks",
    lambda s: s["decision"],
    {
        "normal": END,
        "small_alert": "pass_to_llm",
        "high_alert": "emergency_call",
        "high_stress": "therapist_call"
    },
)

graph.add_edge("pass_to_llm", "sms_alert")
graph.add_edge("sms_alert", END)


graph.add_edge("emergency_call", END)
graph.add_conditional_edges(
    "therapist_call",
    lambda s: s["decision"],
    {
        "normal": END,
        "escalate": "family_call",
    },
)
graph.add_edge("family_call", END)

# ---- COMPILE ----
emergency_workflow = graph.compile()



