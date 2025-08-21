from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
client = MongoClient(MONGODB_URI)

db = client.health_data_db

realtime_data_collection = db["realtime_data"]
daily_data_collection = db["daily_data"]

def init_db():
    return db

