"""Pydantic request/response schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    user: dict


# ── Patient ───────────────────────────────────────────────────────────────────

class PatientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=0, le=120)
    gender: str
    village: str
    phone: Optional[str] = None
    existing_conditions: Optional[str] = None
    symptoms: list[str] = []
    temperature: Optional[float] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    blood_pressure: Optional[str] = None
    required_medicine: Optional[str] = None
    notes: Optional[str] = None


class PatientOut(BaseModel):
    id: int
    patient_code: str
    name: str
    age: int
    gender: str
    village: str
    phone: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Risk ──────────────────────────────────────────────────────────────────────

class RiskRequest(BaseModel):
    symptoms: list[str] = []
    temperature: Optional[float] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    blood_pressure: Optional[str] = None


class RiskResponse(BaseModel):
    risk_level: str
    risk_score: int
    reasons: list[str]
    recommended_action: str


# ── Inventory ─────────────────────────────────────────────────────────────────

class InventoryUpdate(BaseModel):
    quantity: int = Field(ge=0)
    minimum_stock: Optional[int] = None


class InventoryOut(BaseModel):
    id: int
    medicine_id: int
    medicine: str
    category: str
    unit: str
    quantity: int
    minimum_stock: int
    status: str
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Medicine Request ───────────────────────────────────────────────────────────

class RequestCreate(BaseModel):
    patient_id: Optional[int] = None
    medicine_id: int
    source_phc_id: int = 1
    destination_phc_id: int
    quantity: int = Field(gt=0)
    notes: Optional[str] = None


class RequestUpdate(BaseModel):
    status: str  # APPROVED | REJECTED | COMPLETED


class RequestOut(BaseModel):
    id: int
    medicine_id: int
    medicine: str
    quantity: int
    status: str
    source_phc_id: int
    destination_phc_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Sync ──────────────────────────────────────────────────────────────────────

class SyncRecord(BaseModel):
    local_id: Optional[str] = None
    payload: dict


class SyncBatch(BaseModel):
    records: list[SyncRecord]


class SyncResult(BaseModel):
    synced: int
    failed: int
    results: list[dict]


# ── AI Validation Schemas ──────────────────────────────────────────────────────

class SymptomExtractionRequest(BaseModel):
    text: str


class SymptomExtractionResponse(BaseModel):
    fever: bool = False
    fever_duration_days: Optional[int] = None
    cough: bool = False
    breathing_difficulty: bool = False
    chest_pain: bool = False
    weakness: bool = False
    vomiting: bool = False
    other_symptoms: list[str] = []


class PatientSummaryRequest(BaseModel):
    age: int
    symptoms: list[str]
    temperature: Optional[float] = None
    spo2: Optional[int] = None
    heart_rate: Optional[int] = None
    risk_level: str


class PatientSummaryResponse(BaseModel):
    summary: str


class RiskExplanationRequest(BaseModel):
    risk_level: str
    risk_score: int
    reasons: list[str]
    age: int
    symptoms: list[str]


class RiskExplanationResponse(BaseModel):
    risk_level: str
    risk_score: int
    explanation: list[str]
    recommended_urgency: str


class CopilotRequest(BaseModel):
    question: str


class CopilotResponse(BaseModel):
    answer: str
    context_used: Optional[dict] = None


class PHCRecommendationRequest(BaseModel):
    current_phc_id: int
    medicine_id: int
    required_quantity: int


class PHCRecommendationResponse(BaseModel):
    recommended_phc_id: int
    recommended_phc_name: str
    explanation: str


class DemandForecastResponse(BaseModel):
    medicine: str
    current_stock: int
    predicted_7_day_demand: int
    predicted_14_day_demand: int
    stockout_risk: str
    recommended_reorder_quantity: int
    explanation: str


class StockoutAlert(BaseModel):
    medicine: str
    current_stock: int
    predicted_demand: int
    risk: str


class AnomalyAlert(BaseModel):
    medicine: str
    phc: str
    observed_usage: int
    normal_range: str
    anomaly: bool
    severity: str
    explanation: str


class AIStatusResponse(BaseModel):
    connected: bool
    model: str
    status_message: str

