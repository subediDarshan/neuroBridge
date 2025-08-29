from langgraph.graph import StateGraph, END
from typing import TypedDict
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from config.db import daily_data_collection
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate
import json

load_dotenv()

model = init_chat_model(model="gemini-2.0-flash", model_provider="google_genai")




# ---- STATE ----
class State(TypedDict):
    data: dict
    status: str
    sms_message: str


# ---- NODES ----
def aggregate_data(state: State):
    latest_daily_data = daily_data_collection.find_one(sort=[("timestamp", -1)], projection={"_id": 0}) or {}
    if latest_daily_data == {}:
        return END
    
    return {"status": "data_collected", "data": latest_daily_data}


def pass_to_llm(state: State):
    data = state["data"]

    class SmsMessage(BaseModel):
        message: str = Field(description='Short SMS message for the patient')


    parser = PydanticOutputParser(pydantic_object=SmsMessage)

    template = PromptTemplate(
        template="""
        You are an AI health assistant performing a daily wellness check.
        Every day, you receive the patient's latest health data.

        Patient Data:
        {patient_data}

        Task:
        1. Analyze the daily data and summarize the patient's overall wellness.
        2. Generate a short, friendly SMS (max 2 sentences, under 200 characters).
        3. Include positive highlights, small alerts if any, and simple tips (hydration, sleep, activity, nutrition).
        4. Avoid medical jargon; keep it motivating and easy to understand.
        5. Return ONLY the SMS text, nothing else.

        
        {format_instruction}
        """,
        input_variables=["patient_data"],
        partial_variables={'format_instruction':parser.get_format_instructions()}
    )

    chain = template | model | parser
    final_result = chain.invoke({"patient_data": json.dumps(data, indent=2, default=str)})

    return {**state, "sms_message": final_result.message}


def sms_alert(state: State):
    print("📩 Sending SMS alert...")
    sms_message = state.get("sms_message")
    print(f"sms_message: {sms_message}")
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
daily_workflow = graph.compile()

if __name__ == "__main__":
    daily_workflow.invoke({})


