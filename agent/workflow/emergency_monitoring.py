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

load_dotenv()

model = init_chat_model(model="gemini-2.0-flash", model_provider="google_genai")




# ---- STATE ----
class State(TypedDict):
    data: dict
    status: str
    decision: str
    alert_sent: bool
    sms_message: str


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
    else:
        status_list.append("High Alert")

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
    print("📩 Sending SMS alert...")

    validated_data = call_sms_history(type = "emergency_sms", timestamp = datetime.now(timezone.utc))
    call_sms_history_collection.insert_one(validated_data.model_dump())


    sms_message = state.get("sms_message")
    print(f"SMS: {sms_message}")
    # Twilio Integration for SMS
    return {"alert_sent": True}


def emergency_call(state: State):
    print("🚨 Emergency Call triggered!")

    validated_data = call_sms_history(type = "emergency_call", timestamp = datetime.now(timezone.utc))
    call_sms_history_collection.insert_one(validated_data.model_dump())

    # Twilio integration for call
    return {"decision": "called"}


# ---- GRAPH ----
graph = StateGraph(State)

graph.add_node("take_data", take_data)
graph.add_node("hardcoded_checks", hardcoded_checks)
graph.add_node("pass_to_llm", pass_to_llm)
graph.add_node("sms_alert", sms_alert)
graph.add_node("emergency_call", emergency_call)

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
        "high_alert": "emergency_call"
    },
)

graph.add_edge("pass_to_llm", "sms_alert")
graph.add_edge("sms_alert", END)


graph.add_edge("emergency_call", END)

# ---- COMPILE ----
emergency_workflow = graph.compile()



