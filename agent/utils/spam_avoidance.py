from config.db import call_sms_history_collection
from datetime import datetime, timezone

def cooled_off(type):
    latest_doc = call_sms_history_collection.find_one(
        {"type": type}, 
        sort=[("timestamp", -1)],
        projection={"timestamp": 1, "_id": 0}
    )

    if latest_doc:
        timestamp = latest_doc["timestamp"]

        # Make it aware in UTC
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=timezone.utc)

        diff = (datetime.now(timezone.utc) - timestamp).total_seconds() / 60
        if diff > 30:
            return True
        else:
            return False
    else:
        return True