from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
client = MongoClient(MONGODB_URI)

health_data_db = client.health_data_db
my_db = client.mydatabase

realtime_data_collection = health_data_db["realtime_data"]
daily_data_collection = health_data_db["daily_data"]
user_collection = my_db["users"]
call_sms_history_collection = health_data_db["call_sms_history"]

def init_db():
    return health_data_db

