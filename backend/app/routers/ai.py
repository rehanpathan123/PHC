from datetime import datetime, timedelta
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User, Patient, Assessment, Inventory, Medicine, PHC, MedicineRequest
from app.auth import get_current_user, require_roles
from app.schemas import (
    SymptomExtractionRequest,
    SymptomExtractionResponse,
    PatientSummaryRequest,
    PatientSummaryResponse,
    RiskExplanationRequest,
    RiskExplanationResponse,
    CopilotRequest,
    CopilotResponse,
    PHCRecommendationRequest,
    PHCRecommendationResponse,
    DemandForecastResponse,
    AIStatusResponse,
)
from app.services import ollama_service, demand_forecasting, anomaly_detection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.get("/status", response_model=AIStatusResponse)
def get_ai_status(current_user: User = Depends(get_current_user)):
    """Check if Ollama is online and responsive with pulled models."""
    ready = ollama_service.is_ollama_ready()
    status_msg = "Connected to Ollama" if ready else "Local AI Offline. Fallbacks active."
    return {
        "connected": ready,
        "model": ollama_service.OLLAMA_MODEL,
        "status_message": status_msg,
    }


@router.post("/extract-symptoms", response_model=SymptomExtractionResponse)
def extract_symptoms(
    body: SymptomExtractionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract structured symptom JSON from text voice input."""
    # Attempt to use Ollama
    extracted = ollama_service.extract_symptoms(body.text, user_id=current_user.id)
    if extracted:
        try:
            # Validate JSON matches schema
            return SymptomExtractionResponse(**extracted)
        except Exception:
            logger.warning("Ollama output did not match expected schema: %s", extracted)

    # Fallback rule-based parsing if Ollama is offline or invalid
    text_lower = body.text.lower()
    fever = any(w in text_lower for w in ["fever", "bukhar", "fever hai", "temperature"])
    cough = any(w in text_lower for w in ["cough", "khansi", "coughing"])
    breathing = any(w in text_lower for w in ["breath", "saans", "breathing difficulty", "saas"])
    chest_pain = any(w in text_lower for w in ["chest pain", "seene me dard", "chest"])
    weakness = any(w in text_lower for w in ["weakness", "kamzori", "thakan"])
    vomiting = any(w in text_lower for w in ["vomit", "ulti", "vomiting"])

    duration = None
    # Very basic duraton extraction e.g. "3 din" -> 3
    for word in text_lower.split():
        if word.isdigit():
            val = int(word)
            if "din" in text_lower or "day" in text_lower:
                duration = val
                break

    return SymptomExtractionResponse(
        fever=fever,
        fever_duration_days=duration,
        cough=cough,
        breathing_difficulty=breathing,
        chest_pain=chest_pain,
        weakness=weakness,
        vomiting=vomiting,
        other_symptoms=[],
    )


@router.post("/patient-summary", response_model=PatientSummaryResponse)
def generate_patient_summary(
    body: PatientSummaryRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate concise professional patient assessment summary."""
    summary = ollama_service.generate_patient_summary(body.model_dump(), user_id=current_user.id)
    if summary:
        return PatientSummaryResponse(summary=summary)

    # Fallback formatting
    symptom_list = ", ".join(body.symptoms) or "no symptoms"
    fallback_text = (
        f"Patient is {body.age} years old presenting with {symptom_list}. "
        f"Temperature is {body.temperature}°C, SpO2 is {body.spo2}%, and heart rate is {body.heart_rate} bpm. "
        f"Deterministic assessment calculated risk level as {body.risk_level}."
    )
    return PatientSummaryResponse(summary=fallback_text)


@router.post("/risk-explanation", response_model=RiskExplanationResponse)
def generate_risk_explanation(
    body: RiskExplanationRequest,
    current_user: User = Depends(get_current_user),
):
    """Explain risk assessment reasons calculated by backend rules."""
    explanation = ollama_service.generate_risk_explanation(
        risk_level=body.risk_level,
        risk_score=body.risk_score,
        reasons=body.reasons,
        age=body.age,
        symptoms=body.symptoms,
        user_id=current_user.id,
    )
    if explanation:
        try:
            return RiskExplanationResponse(**explanation)
        except Exception:
            pass

    # Fallback explanation
    urgency = "URGENT" if body.risk_level == "HIGH" else "STANDARD" if body.risk_level == "MEDIUM" else "ROUTINE"
    fallback_bullets = [
        f"Computed risk level is {body.risk_level} with a score of {body.risk_score}/100.",
        f"Flagged reasons: {', '.join(body.reasons)}.",
        f"Recommended Urgency Level: {urgency}.",
    ]
    return RiskExplanationResponse(
        risk_level=body.risk_level,
        risk_score=body.risk_score,
        explanation=fallback_bullets,
        recommended_urgency=urgency,
    )


@router.post("/phc-recommendation", response_model=PHCRecommendationResponse)
def get_phc_recommendation(
    body: PHCRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculate PHC transfer recommendation and explain via Ollama."""
    current_phc = db.get(PHC, body.current_phc_id)
    med = db.get(Medicine, body.medicine_id)
    if not current_phc or not med:
        raise HTTPException(status_code=404, detail="PHC or medicine not found")

    # Retrieve all PHCs that have the medicine in stock
    inventories = db.execute(
        select(Inventory, PHC)
        .join(PHC)
        .where(
            Inventory.medicine_id == body.medicine_id,
            Inventory.quantity >= body.required_quantity,
            Inventory.phc_id != body.current_phc_id
        )
    ).all()

    options = []
    # Haversine distance
    import math
    for inv, phc in inventories:
        R = 6371
        p = math.pi / 180
        dlat = (phc.latitude - current_phc.latitude) * p
        dlon = (phc.longitude - current_phc.longitude) * p
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(current_phc.latitude * p) * math.cos(phc.latitude * p) * math.sin(dlon / 2) ** 2
        )
        distance = round(2 * R * math.asin(math.sqrt(a)), 1)
        # Load score (fewer requests is better)
        req_count = db.scalar(
            select(func.count(MedicineRequest.id))
            .where(
                MedicineRequest.destination_phc_id == phc.id,
                MedicineRequest.status == "PENDING"
            )
        ) or 0
        load_score = "Low" if req_count < 2 else "Medium" if req_count < 5 else "High"

        # Overall recommendation score calculation: Suitability = distance + (load weight)
        # lower load + lower distance is better
        score = distance + (0 if load_score == "Low" else 5 if load_score == "Medium" else 15)
        options.append({
            "phc_id": phc.id,
            "name": phc.name,
            "distance": distance,
            "load": load_score,
            "score": score,
            "stock": inv.quantity,
        })

    # Sort by recommendation score (lowest suitability score is best)
    options.sort(key=lambda x: x["score"])

    if not options:
        # Fallback if no PHC has required quantity
        raise HTTPException(status_code=400, detail="No nearby PHC has the required quantity available.")

    best = options[0]

    # Generate natural language explanation using Ollama
    options_details = "\n".join([
        f"- {o['name']}: Distance {o['distance']}km, Workload: {o['load']}, Stock: {o['stock']}"
        for o in options[:3]
    ])
    explanation = ollama_service.generate_phc_recommendation_explanation(
        recommended_phc_name=best["name"],
        distance=best["distance"],
        workload=best["load"],
        medicine_name=med.name,
        options_details=options_details,
        user_id=current_user.id,
    )

    if not explanation:
        explanation = (
            f"{best['name']} is recommended because it is {best['distance']} km away and has "
            f"{best['stock']} units of {med.name} in stock, with a {best['load']} current workload."
        )

    return PHCRecommendationResponse(
        recommended_phc_id=best["phc_id"],
        recommended_phc_name=best["name"],
        explanation=explanation,
    )


@router.get("/demand-forecast", response_model=DemandForecastResponse)
def get_demand_forecast(
    phc_id: int = Query(1),
    medicine_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Predict demand stock-out and generate natural language explanation."""
    forecast = demand_forecasting.forecast_demand(db, phc_id, medicine_id)
    if not forecast:
        raise HTTPException(status_code=404, detail="Medicine or PHC not found")

    details = (
        f"Medicine: {forecast['medicine']}\n"
        f"Current Stock: {forecast['current_stock']}\n"
        f"Predicted 7-day Demand: {forecast['predicted_7_day_demand']}\n"
        f"Predicted 14-day Demand: {forecast['predicted_14_day_demand']}\n"
        f"Stock-out Risk: {forecast['stockout_risk']}\n"
        f"Recommended Reorder Quantity: {forecast['recommended_reorder_quantity']}"
    )

    explanation = ollama_service.generate_inventory_explanation(
        context_type="Demand Forecast",
        details=details,
        user_id=current_user.id,
    )
    if not explanation:
        explanation = (
            f"Demand for {forecast['medicine']} is predicted at {forecast['predicted_7_day_demand']} units over the next 7 days. "
            f"Given your stock of {forecast['current_stock']} units, the stockout risk is flagged as {forecast['stockout_risk']}."
        )

    return DemandForecastResponse(
        medicine=forecast["medicine"],
        current_stock=forecast["current_stock"],
        predicted_7_day_demand=forecast["predicted_7_day_demand"],
        predicted_14_day_demand=forecast["predicted_14_day_demand"],
        stockout_risk=forecast["stockout_risk"],
        recommended_reorder_quantity=forecast["recommended_reorder_quantity"],
        explanation=explanation,
    )


@router.get("/stockout-alerts")
def get_stockout_alerts(
    phc_id: int = Query(1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get list of medicines with high/medium stock-out risk."""
    medicines = db.scalars(select(Medicine)).all()
    alerts = []
    for med in medicines:
        forecast = demand_forecasting.forecast_demand(db, phc_id, med.id)
        if forecast and forecast["stockout_risk"] in ("HIGH", "MEDIUM"):
            alerts.append({
                "medicine": med.name,
                "current_stock": forecast["current_stock"],
                "predicted_demand": forecast["predicted_7_day_demand"],
                "risk": forecast["stockout_risk"],
            })
    return alerts


@router.get("/anomalies")
def get_inventory_anomalies(
    phc_id: int = Query(1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detect unusual inventory patterns and generate descriptions using Ollama."""
    anomalies = anomaly_detection.detect_anomalies(db, phc_id)
    results = []
    for a in anomalies:
        details = (
            f"Medicine: {a['medicine']}\n"
            f"Observed Usage: {a['observed_usage']} requests/day\n"
            f"Normal Range: {a['normal_range']}\n"
            f"Severity: {a['severity']}"
        )
        explanation = ollama_service.generate_inventory_explanation(
            context_type="Inventory Anomaly",
            details=details,
            user_id=current_user.id,
        )
        if not explanation:
            explanation = a["explanation"]
        results.append({
            **a,
            "explanation": explanation,
        })
    return results


# ── AI Copilot ─────────────────────────────────────────────────────────────────

@router.post("/copilot", response_model=CopilotResponse)
def answer_copilot_question(
    body: CopilotRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Answer questions from the PHC officer using intent detection and query tools."""
    q_lower = body.question.lower()
    phc_id = current_user.phc_id or 1

    # 1. Intent Detection & Data Retrieval
    context_data = {}
    intent = "general"

    if any(w in q_lower for w in ["run out", "stockout", "stock-out", "empty", "depleted"]):
        intent = "stockout_risk"
        # Get low stock medicines & predictions
        medicines = db.scalars(select(Medicine)).all()
        low_stock_details = []
        for m in medicines:
            forecast = demand_forecasting.forecast_demand(db, phc_id, m.id)
            if forecast and forecast["stockout_risk"] in ("HIGH", "MEDIUM"):
                low_stock_details.append(forecast)
        context_data["stockout_risks"] = low_stock_details

    elif any(w in q_lower for w in ["high risk", "critical", "risk"]):
        intent = "high_risk_patients"
        # Query patient codes and vitals for HIGH risk assessments
        stmt = (
            select(Patient.name, Patient.patient_code, Assessment.risk_level, Assessment.risk_score, Assessment.symptoms)
            .join(Assessment)
            .where(Assessment.risk_level == "HIGH")
            .order_by(Assessment.created_at.desc())
        )
        rows = db.execute(stmt).all()
        context_data["high_risk_patients"] = [
            {"name": name, "code": code, "level": lvl, "score": score}
            for name, code, lvl, score, sym in rows
        ]

    elif any(w in q_lower for w in ["anomaly", "anomalies", "spike", "unusual"]):
        intent = "inventory_anomalies"
        context_data["anomalies"] = anomaly_detection.detect_anomalies(db, phc_id)

    elif any(w in q_lower for w in ["medicine", "recommend", "patient", "symptoms", "dawa", "bukhar", "fever", "pain", "dard", "ilaaj", "treatment", "give"]):
        intent = "medicine_recommendation"
        # Get all medicines and their inventory across all PHCs
        medicines = db.scalars(select(Medicine)).all()
        inventories = db.execute(select(Inventory, PHC).join(PHC)).all()
        
        inventory_map = {}
        for inv, phc in inventories:
            if inv.medicine_id not in inventory_map:
                inventory_map[inv.medicine_id] = []
            if inv.quantity > 0:
                inventory_map[inv.medicine_id].append(f"{phc.name} (Stock: {inv.quantity})")
                
        medicine_details = []
        for m in medicines:
            avail = inventory_map.get(m.id, [])
            medicine_details.append({
                "medicine": m.name,
                "availability": ", ".join(avail) if avail else "Out of stock everywhere"
            })
            
        context_data["medicines_and_availability"] = medicine_details

    elif any(w in q_lower for w in ["statistics", "stats", "today"]):
        intent = "statistics"
        # Dashboard stats
        total_patients = db.scalar(select(func.count()).select_from(Patient)) or 0
        ass = db.scalars(select(Assessment)).all()
        risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        for a in ass:
            risk_counts[a.risk_level] = risk_counts.get(a.risk_level, 0) + 1
        context_data["dashboard_summary"] = {
            "total_patients": total_patients,
            "risk_distribution": risk_counts,
            "total_assessments": len(ass),
        }

    else:
        # Default fallback context: generic summary of current PHC
        phc = db.get(PHC, phc_id)
        context_data["phc_info"] = {
            "name": phc.name if phc else "Unknown PHC",
            "district": phc.district if phc else "Unknown District",
        }

    # 2. Answer question using context data with Ollama Copilot Prompt
    answer = ollama_service.answer_copilot_question(
        question=body.question,
        context_data=context_data,
        user_id=current_user.id,
    )

    if not answer:
        # Static fallback if Ollama is unavailable
        if intent == "stockout_risk":
            items = [x["medicine"] for x in context_data.get("stockout_risks", [])]
            answer = f"The following medicines have a high/medium stockout risk: {', '.join(items) if items else 'None'}."
        elif intent == "high_risk_patients":
            pts = [x["name"] for x in context_data.get("high_risk_patients", [])]
            answer = f"There are currently {len(pts)} high-risk patients. Cases: {', '.join(pts) if pts else 'None'}."
        elif intent == "inventory_anomalies":
            anom = [x["medicine"] for x in context_data.get("anomalies", [])]
            answer = f"Detected {len(anom)} inventory anomalies requiring verification: {', '.join(anom) if anom else 'None'}."
        elif intent == "medicine_recommendation":
            answer = "I am operating in offline mode. Please refer to the PHC clinical guidelines for medicine recommendations."
        else:
            answer = "I cannot process that request while the local AI model is offline. Core application services remain active."

    return CopilotResponse(
        answer=answer,
        context_used=context_data,
    )
