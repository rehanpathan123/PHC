"""Risk assessment router."""
from fastapi import APIRouter, Depends
from app.auth import get_current_user
from app.models import User
from app.schemas import RiskRequest, RiskResponse
from app.risk_engine import assess_risk, VitalSigns

router = APIRouter(prefix="/api", tags=["risk"])


@router.post("/risk-assessment", response_model=RiskResponse)
def run_risk_assessment(
    body: RiskRequest,
    current_user: User = Depends(get_current_user),
):
    vitals = VitalSigns(
        symptoms=body.symptoms,
        temperature=body.temperature,
        heart_rate=body.heart_rate,
        spo2=body.spo2,
        blood_pressure=body.blood_pressure,
    )
    return assess_risk(vitals)
