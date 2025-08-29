import socketio
import threading
from config.db import realtime_data_collection, daily_data_collection
from models.realtime_data import realtime_data
from models.daily_data import daily_data
from workflow.emergency_monitoring import emergency_workflow
from workflow.daily_wellness_check import daily_workflow

sio = socketio.Client()

def save_to_db(collection, validated_data):
    """Insert into MongoDB in a separate thread"""
    def task():
        try:
            collection.insert_one(validated_data.model_dump())
        except Exception as e:
            print(f"❌ DB insert failed: {e}")
    threading.Thread(target=task, daemon=True).start()

def register_handlers():

    @sio.on("connect")
    def on_connect():
        print("✅ Connected to server")


    @sio.on("realtimeData")
    def on_realtime_data_handler(data):
        print("📡 Received Realtime Data:", data)
        try:
            validated = realtime_data(**data)
            save_to_db(realtime_data_collection, validated)
        except Exception as e:
            print(f"❌ Validation failed for realtime data: {e}")
        

        excluded_keys = {"steps", "calories_burned"} 
        filtered_data = {k: v for k, v in data.items() if k not in excluded_keys}

        initial_state = {
            "data": filtered_data,
            "alert_sent": False,
        }
        def task():
            emergency_workflow.invoke(initial_state)
        threading.Thread(target=task, daemon=True).start()



    @sio.on("dailyData")
    def on_daily_data_handler(data):
        print("📡 Received Daily Data:", data)
        try:
            validated = daily_data(**data)
            save_to_db(daily_data_collection, validated)
        except Exception as e:
            print(f"❌ Validation failed for daily data: {e}")
        
        def task():
            daily_workflow.invoke({})
        threading.Thread(target=task, daemon=True).start()


    @sio.on("overrideSet")
    def on_override(data):
        print("🚨 Override triggered:", data)


    @sio.on("overrideCleared")
    def on_reset():
        print("✅ Override cleared")


    @sio.on("disconnect")
    def on_disconnect():
        print("❌ Disconnected from server")
        

def connect_to_server(url="http://localhost:3000"):
    register_handlers()
    sio.connect(url)
    sio.wait()

