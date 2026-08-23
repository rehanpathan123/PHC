"""Offline sync router — accepts batches of locally stored patient records."""
import json
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User, Patient, Assessment, SyncLog
from app.auth import require_roles
from app.risk_engine import assess_risk, VitalSigns

router = APIRouter(prefix="/api/sync", tags=["sync"])


@router.post("")
def sync_records(
    records: list[dict],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ASHA", "OFFICER", "ADMIN")),
):
    """
    Accept a batch of offline patient records and persist them.

    Each record is a patient payload that may have been created while offline.
    Returns per-record success/failure so the client can mark them accordingly.
    """
    results = []
    synced = 0
    failed = 0

    for record in records:
        local_id = record.get("local_id")
        payload = record.get("payload", record)  # support both wrapped and bare

        try:
            # Build patient
            code = f"PHC-SYNC-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
            patient = Patient(
                patient_code=code,
                name=payload.get("name", "Unknown"),
                age=int(payload.get("age", 0)),
                gender=payload.get("gender", ""),
                village=payload.get("village", ""),
                phone=payload.get("phone"),
                existing_conditions=payload.get("existing_conditions"),
                created_by=current_user.id,
                phc_id=current_user.phc_id,
            )
            db.add(patient)
            db.flush()

            # Risk assessment
            vitals = VitalSigns(
                symptoms=payload.get("symptoms", []),
                temperature=payload.get("temperature"),
                heart_rate=payload.get("heart_rate"),
                spo2=payload.get("spo2"),
                blood_pressure=payload.get("blood_pressure"),
            )
            risk = assess_risk(vitals)

            assessment = Assessment(
                patient_id=patient.id,
                symptoms=json.dumps(payload.get("symptoms", [])),
                temperature=payload.get("temperature"),
                heart_rate=payload.get("heart_rate"),
                spo2=payload.get("spo2"),
                blood_pressure=payload.get("blood_pressure"),
                risk_score=risk["risk_score"],
                risk_level=risk["risk_level"],
                reasons=json.dumps(risk["reasons"]),
                recommended_action=risk["recommended_action"],
                required_medicine=payload.get("required_medicine"),
                notes=payload.get("notes"),
            )
            db.add(assessment)

            log = SyncLog(
                user_id=current_user.id,
                record_type="patient",
                local_id=str(local_id) if local_id else None,
                status="SYNCED",
            )
            db.add(log)
            db.commit()

            results.append({
                "local_id": local_id,
                "status": "SYNCED",
                "patient_id": patient.id,
                "patient_code": patient.patient_code,
            })
            synced += 1

        except Exception as exc:
            db.rollback()
            log = SyncLog(
                user_id=current_user.id,
                record_type="patient",
                local_id=str(local_id) if local_id else None,
                status="FAILED",
                error_message=str(exc),
            )
            db.add(log)
            db.commit()
            results.append({"local_id": local_id, "status": "FAILED", "error": str(exc)})
            failed += 1

    return {"synced": synced, "failed": failed, "results": results}


@router.get("/status")
def sync_status(current_user: User = Depends(require_roles("ASHA", "OFFICER", "ADMIN"))):
    return {"status": "READY", "server_time": datetime.utcnow()}
