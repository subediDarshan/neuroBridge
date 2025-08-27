from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Literal


class SleepData(BaseModel):
    duration: int  # minutes
    quality: Literal["good", "average", "poor"]
    start: datetime
    end: datetime

    @field_validator("start", "end", mode="before")
    def parse_ts(cls, v):
        return datetime.fromtimestamp(v / 1000)


class NutritionData(BaseModel):
    calories: int
    protein: int
    carbs: int
    fat: int



class daily_data(BaseModel):
    sleep: SleepData
    nutrition: NutritionData
    water_intake: float
    energy_score: int
    timestamp: datetime

    @field_validator("timestamp", mode="before")
    def parse_ts(cls, v):
        return datetime.fromtimestamp(v / 1000)
