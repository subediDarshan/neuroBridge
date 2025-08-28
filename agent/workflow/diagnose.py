from langgraph.graph import StateGraph, END
from typing import TypedDict
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from config.db import realtime_data_collection, daily_data_collection
from pymongo import DESCENDING
from langchain_core.output_parsers import PydanticOutputParser
from langchain_core.prompts import PromptTemplate
from datetime import datetime, timedelta
import json

load_dotenv()

model = init_chat_model(model="gemini-2.0-flash", model_provider="google_genai")


# ---- STATE ----
class State(TypedDict):
    realtime_trends: dict
    daily_trends: dict
    analysis: dict
    prediction: str
    status: str
    sms_message: str
    should_alert: bool


# ---- NODES ----
def take_data_3month(state: State):
    """Aggregate 3 months of both realtime and daily data"""
    
    # Calculate date 3 months ago
    three_months_ago = datetime.now() - timedelta(days=90)
    
    # Get realtime data for past 3 months
    realtime_data = list(realtime_data_collection.find(
        {"timestamp": {"$gte": three_months_ago}}
    ).sort("timestamp", DESCENDING))
    
    # Get daily data for past 3 months
    daily_data = list(daily_data_collection.find(
        {"timestamp": {"$gte": three_months_ago}}
    ).sort("timestamp", DESCENDING))

    if(len(realtime_data) == 0 or len(daily_data) == 0):
        return END

    # Analyze realtime trends
    realtime_trends = {}
    if realtime_data:
        # Group by week for trend analysis
        weekly_data = {}
        for record in realtime_data:
            week_key = record["timestamp"].strftime("%Y-W%U")
            if week_key not in weekly_data:
                weekly_data[week_key] = []
            weekly_data[week_key].append(record)
        
        # Calculate weekly averages
        weekly_averages = {}
        for week, records in weekly_data.items():
            weekly_averages[week] = {
                "avg_hr": sum(r["heart_rate"] for r in records) / len(records),
                "avg_spo2": sum(r["spo2"] for r in records) / len(records),
                "avg_stress": sum(r["stress_level"] for r in records) / len(records),
                "total_steps": sum(r["steps"] for r in records),
                "total_calories": sum(r["calories_burned"] for r in records),
                "record_count": len(records)
            }
        
        realtime_trends = {
            "total_records": len(realtime_data),
            "date_range": {
                "start": realtime_data[-1]["timestamp"].isoformat(),
                "end": realtime_data[0]["timestamp"].isoformat()
            },
            "weekly_averages": weekly_averages,
            "overall_averages": {
                "heart_rate": sum(r["heart_rate"] for r in realtime_data) / len(realtime_data),
                "spo2": sum(r["spo2"] for r in realtime_data) / len(realtime_data),
                "stress_level": sum(r["stress_level"] for r in realtime_data) / len(realtime_data)
            }
        }
    
    # Analyze daily trends
    daily_trends = {}
    if daily_data:
        sleep_patterns = []
        nutrition_patterns = []
        energy_scores = []
        water_intake = []
        
        for record in daily_data:
            if "sleep" in record:
                sleep_patterns.append({
                    "duration": record["sleep"]["duration"],
                    "quality": record["sleep"]["quality"],
                    "date": record["timestamp"].isoformat()
                })
            
            if "nutrition" in record:
                nutrition_patterns.append({
                    "calories": record["nutrition"]["calories"],
                    "protein": record["nutrition"]["protein"],
                    "carbs": record["nutrition"]["carbs"],
                    "fat": record["nutrition"]["fat"],
                    "date": record["timestamp"].isoformat()
                })
            
            if "energy_score" in record:
                energy_scores.append(record["energy_score"])
                
            if "water_intake" in record:
                water_intake.append(record["water_intake"])
        
        daily_trends = {
            "total_days": len(daily_data),
            "sleep_analysis": {
                "average_duration": sum(s["duration"] for s in sleep_patterns) / len(sleep_patterns) if sleep_patterns else 0,
                "quality_distribution": {
                    "good": sum(1 for s in sleep_patterns if s["quality"] == "good"),
                    "average": sum(1 for s in sleep_patterns if s["quality"] == "average"),
                    "poor": sum(1 for s in sleep_patterns if s["quality"] == "poor")
                },
                "recent_pattern": sleep_patterns[:7] if sleep_patterns else []
            },
            "nutrition_analysis": {
                "avg_calories": sum(n["calories"] for n in nutrition_patterns) / len(nutrition_patterns) if nutrition_patterns else 0,
                "avg_protein": sum(n["protein"] for n in nutrition_patterns) / len(nutrition_patterns) if nutrition_patterns else 0,
                "recent_pattern": nutrition_patterns[:7] if nutrition_patterns else []
            },
            "energy_trends": {
                "average_score": sum(energy_scores) / len(energy_scores) if energy_scores else 0,
                "recent_scores": energy_scores[:14] if energy_scores else []
            },
            "hydration_trends": {
                "average_intake": sum(water_intake) / len(water_intake) if water_intake else 0,
                "recent_intake": water_intake[:14] if water_intake else []
            }
        }
    
    return {
        "status": "data_collected",
        "realtime_trends": realtime_trends,
        "daily_trends": daily_trends
    }


def pass_to_llm(state: State):
    """Pass aggregated data to LLM for trend analysis and prediction"""
    
    realtime_data = state["realtime_trends"]
    daily_data = state["daily_trends"]
    
    class HealthAnalysis(BaseModel):
        trend_summary: str = Field(description="Summary of key health trends over 3 months")
        risk_factors: list = Field(description="List of identified risk factors or concerning patterns")
        prediction: str = Field(description="Prediction: 'normal', 'watch', or 'concern'")
        confidence_level: str = Field(description="Confidence in prediction: 'low', 'medium', 'high'")
        recommendations: list = Field(description="List of actionable recommendations")
        sms_message: str = Field(description="SMS message if alert is needed (empty if normal)")

    parser = PydanticOutputParser(pydantic_object=HealthAnalysis)

    template = PromptTemplate(
        template="""
        You are an AI health assistant analyzing 3 months of patient health data to identify trends and predict potential health issues.

        REALTIME DATA TRENDS (3 months):
        {realtime_trends}

        DAILY LIFESTYLE DATA TRENDS (3 months):
        {daily_trends}

        ANALYSIS TASK:
        1. Identify significant trends in:
            - Heart rate patterns and variability
            - SpO2 levels and consistency  
            - Stress levels and triggers
            - Sleep quality and duration patterns
            - Nutrition and energy correlations
            - Activity levels and recovery patterns

        2. Look for concerning patterns such as:
            - Gradual decline in any vital signs
            - Increasing stress levels over time
            - Deteriorating sleep quality
            - Reduced activity tolerance
            - Nutritional imbalances affecting health markers

        3. Make a prediction:
            - "normal": All trends are within healthy ranges
            - "watch": Some trends need monitoring but not immediate concern  
            - "concern": Patterns suggest potential health issues developing

        4. If prediction is "watch" or "concern", create a short SMS (under 200 chars) suggesting:
            - What trend was noticed
            - Simple preventive action
            - Suggestion to consult healthcare provider if needed

        5. Focus on TRENDS and CHANGES over time, not just current values.

        {format_instruction}
        """,
        input_variables=["realtime_trends", "daily_trends"],
        partial_variables={'format_instruction': parser.get_format_instructions()}
    )

    chain = template | model | parser
    
    # Convert data to JSON strings for the prompt
    realtime_json = json.dumps(realtime_data, indent=2, default=str)
    daily_json = json.dumps(daily_data, indent=2, default=str)
    
    result = chain.invoke({
        "realtime_trends": realtime_json,
        "daily_trends": daily_json
    })

    # Determine if we should send an alert
    should_alert = result.prediction in ["watch", "concern"] and result.sms_message.strip()

    return {
        **state,
        "analysis": {
            "trend_summary": result.trend_summary,
            "risk_factors": result.risk_factors,
            "confidence_level": result.confidence_level,
            "recommendations": result.recommendations
        },
        "prediction": result.prediction,
        "sms_message": result.sms_message,
        "should_alert": should_alert
    }


def send_sms(state: State):
    """Send SMS alert if prediction indicates concern"""
    print("📩 Sending trend analysis SMS alert...")
    print(f"Prediction: {state['prediction']}")
    print(f"SMS: {state['sms_message']}")
    
    # TODO: Integrate with Twilio
    # sms_client.send_message(
    #     to=patient_phone,
    #     body=state['sms_message']
    # )
    
    return {**state, "status": "alert_sent"}


def end_normal(state: State):
    """End node for normal predictions"""
    print("✅ Health trends are normal - no alert needed")
    print(f"Analysis: {state['analysis']['trend_summary']}")
    return {**state, "status": "completed_normal"}


# ---- CONDITIONAL LOGIC ----
def should_send_alert(state: State):
    """Determine if we should send an SMS alert"""
    return "send_sms" if state["should_alert"] else "end_normal"


# ---- GRAPH ----
graph = StateGraph(State)

# Add nodes
graph.add_node("take_data_3month", take_data_3month)
graph.add_node("pass_to_llm", pass_to_llm)
graph.add_node("send_sms", send_sms)
graph.add_node("end_normal", end_normal)

# Set entry point
graph.set_entry_point("take_data_3month")

# Add edges
graph.add_edge("take_data_3month", "pass_to_llm")

# Conditional edge based on LLM prediction
graph.add_conditional_edges(
    "pass_to_llm",
    should_send_alert,
    {
        "send_sms": "send_sms",
        "end_normal": "end_normal"
    }
)

# Both end nodes go to END
graph.add_edge("send_sms", END)
graph.add_edge("end_normal", END)

# ---- COMPILE ----
trend_analysis_workflow = graph.compile()

