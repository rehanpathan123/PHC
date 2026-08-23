"""Patients router — CRUD for patient records."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User, Patient, Assessment
from app.auth import get_current_user, require_roles
from app.schemas import PatientCreate
from app.risk_engine import assess_risk, VitalSigns

router = APIRouter(prefix="/api/patients", tags=["patients"])


def _assessment_data(body: PatientCreate) -> dict:
    vitals = VitalSigns(
        symptoms=body.symptoms,
        temperature=body.temperature,
        heart_rate=body.heart_rate,
        spo2=body.spo2,
        blood_pressure=body.blood_pressure,
    )
    return assess_risk(vitals)


@router.get("")
def list_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patients = db.scalars(select(Patient).order_by(Patient.created_at.desc())).all()
    result = []
    for p in patients:
        last = db.scalars(
            select(Assessment)
            .where(Assessment.patient_id == p.id)
            .order_by(Assessment.created_at.desc())
            .limit(1)
        ).first()
        result.append({
            "id": p.id,
            "patient_code": p.patient_code,
            "name": p.name,
            "age": p.age,
            "gender": p.gender,
            "village": p.village,
            "phone": p.phone,
            "created_at": p.created_at,
            "risk_level": last.risk_level if last else None,
            "risk_score": last.risk_score if last else None,
        })
    return result


@router.post("")
def create_patient(
    body: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ASHA", "OFFICER", "ADMIN")),
):
    code = f"PHC-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    patient = Patient(
        patient_code=code,
        name=body.name,
        age=body.age,
        gender=body.gender,
        village=body.village,
        phone=body.phone,
        existing_conditions=body.existing_conditions,
        created_by=current_user.id,
        phc_id=current_user.phc_id,
    )
    db.add(patient)
    db.flush()

    risk = _assessment_data(body)
    assessment = Assessment(
        patient_id=patient.id,
        symptoms=json.dumps(body.symptoms),
        temperature=body.temperature,
        heart_rate=body.heart_rate,
        spo2=body.spo2,
        blood_pressure=body.blood_pressure,
        risk_score=risk["risk_score"],
        risk_level=risk["risk_level"],
        reasons=json.dumps(risk["reasons"]),
        recommended_action=risk["recommended_action"],
        required_medicine=body.required_medicine,
        notes=body.notes,
    )
    db.add(assessment)
    db.commit()

    return {
        "patient_id": patient.id,
        "patient_code": patient.patient_code,
        "assessment": risk,
    }


@router.get("/{patient_id}")
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    assessments = db.scalars(
        select(Assessment).where(Assessment.patient_id == patient_id).order_by(Assessment.created_at.desc())
    ).all()
    return {
        "id": patient.id,
        "patient_code": patient.patient_code,
        "name": patient.name,
        "age": patient.age,
        "gender": patient.gender,
        "village": patient.village,
        "phone": patient.phone,
        "existing_conditions": patient.existing_conditions,
        "created_at": patient.created_at,
        "assessments": [
            {
                "id": a.id,
                "risk_level": a.risk_level,
                "risk_score": a.risk_score,
                "reasons": json.loads(a.reasons),
                "recommended_action": a.recommended_action,
                "temperature": a.temperature,
                "heart_rate": a.heart_rate,
                "spo2": a.spo2,
                "blood_pressure": a.blood_pressure,
                "symptoms": json.loads(a.symptoms),
                "required_medicine": a.required_medicine,
                "notes": a.notes,
                "created_at": a.created_at,
            }
            for a in assessments
        ],
    }
