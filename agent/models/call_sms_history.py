from pydantic import BaseModel, field_validator
from datetime import datetime

class call_sms_history(BaseModel):
    type: str
    timestamp: datetime