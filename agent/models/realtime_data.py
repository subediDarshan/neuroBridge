from pydantic import BaseModel, field_validator
from datetime import datetime

class realtime_data(BaseModel):
    heart_rate: int
    spo2: int
    stress_level: int
    steps: int
    calories_burned: int
    timestamp: datetime

    @field_validator("timestamp", mode="before")
    def parse_ts(cls, v):
        return datetime.fromtimestamp(v / 1000)