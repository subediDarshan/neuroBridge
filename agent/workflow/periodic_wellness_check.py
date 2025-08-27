from langgraph.graph import StateGraph, END
from typing import TypedDict
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from config.db import realtime_data_collection
from pymongo import DESCENDING
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate
from datetime import datetime, timedelta, timezone

load_dotenv()

model = init_chat_model(model="gemini-2.0-flash", model_provider="google_genai")




# ---- STATE ----
class State(TypedDict):
    data: dict
    status: str
    sms_message: str


# ---- NODES ----
def aggregate_data(state: State):

    # Calculate 5 minutes ago
    three_hours_ago = datetime.now(timezone.utc) - timedelta(hours=3)

    # Query records from last 5 minutes
    past_3h_data = list(
        realtime_data_collection.find(
            {"timestamp": {"$gte": three_hours_ago}}
        ).sort("timestamp", DESCENDING)
    )

    if past_3h_data:
        avg_hr = sum(record["heart_rate"] for record in past_3h_data) / len(past_3h_data)
        avg_spo2 = sum(record["spo2"] for record in past_3h_data) / len(past_3h_data)
        avg_stress = sum(record["stress_level"] for record in past_3h_data) / len(past_3h_data)

        latest_entry = past_3h_data[0]  
        oldest_entry = past_3h_data[-1]  

        steps_walked = latest_entry["steps"] - oldest_entry["steps"]
        calories_burned = latest_entry["calories_burned"] - oldest_entry["calories_burned"]
        
    else:
        avg_hr = avg_spo2 = avg_stress = steps_walked = calories_burned = None  # Handle case where no data is available

    
    data = {
        "avg_hr": avg_hr,
        "avg_spo2": avg_spo2,
        "avg_stress": avg_stress,
        "steps_walked": steps_walked,
        "calories_burned": calories_burned
    }

    return {"status": "data_collected", "data": data}


def pass_to_llm(state: State):
    data = state["data"]

    class SmsMessage(BaseModel):
        message: str = Field(description='Short SMS message for the patient')

    parser = PydanticOutputParser(pydantic_object=SmsMessage)

    template = PromptTemplate(
        template= """
        You are an AI health assistant performing a periodic wellness check.
        Every 3 hours, you receive the patient's latest health data.

        Patient Data:
        - Average Heart Rate: {avg_hr} bpm
        - Average SpO2: {avg_spo2} %
        - Average Stress Level: {avg_stress}
        - Steps Walked: {steps_walked}
        - Calories Burned: {calories_burned}

        Task:
        1. Analyze the data for any deviations from normal ranges.
        2. Provide a short, positive, and encouraging SMS (max 2 sentences, under 200 characters) to the patient.
        3. Mention any small alerts (e.g., slightly high heart rate or low SpO2) in a calm way.
        4. Give simple advice or tips (e.g., hydrate, take a short walk, relax), but do NOT sound alarming.
        5. Avoid medical jargon; keep it friendly and understandable.
        6. Focus on wellness and motivation, not only problems.
        7. Return ONLY the SMS text, nothing else.


        {format_instruction}
        """,
        input_variables=["avg_hr", "avg_spo2", "avg_stress", "steps_walked", "calories_burned"],
        partial_variables={'format_instruction':parser.get_format_instructions()}
    )

    chain = template | model | parser
    final_result = chain.invoke(data)

    return {**state, "sms_message": final_result.message}


def sms_alert(state: State):
    print("📩 Sending SMS alert...")
    
    sms_message = state.get("sms_message")
    # Twilio Integration for SMS
    return {**state, "alert_sent": True}



# ---- GRAPH ----
graph = StateGraph(State)

graph.add_node("aggregate_data", aggregate_data)
graph.add_node("pass_to_llm", pass_to_llm)
graph.add_node("sms_alert", sms_alert)

graph.set_entry_point("aggregate_data")

# ---- EDGES ----
graph.add_edge("aggregate_data", "pass_to_llm")
graph.add_edge("pass_to_llm", "sms_alert")
graph.add_edge("sms_alert", END)


# ---- COMPILE ----
periodic_workflow = graph.compile()


# ---- RUN DEMO ----
final_state = periodic_workflow.invoke()
print("✅ Final state:", final_state)
