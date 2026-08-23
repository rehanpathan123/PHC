"""Medicine requests router — create, list, approve/reject."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User, MedicineRequest, Medicine, PHC
from app.auth import get_current_user, require_roles
from app.schemas import RequestCreate, RequestUpdate

router = APIRouter(prefix="/api/medicine/requests", tags=["requests"])

VALID_STATUSES = {"APPROVED", "REJECTED", "COMPLETED"}


@router.get("")
def list_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    requests = db.scalars(
        select(MedicineRequest).order_by(MedicineRequest.created_at.desc())
    ).all()
    result = []
    for r in requests:
        med = db.get(Medicine, r.medicine_id)
        src = db.get(PHC, r.source_phc_id)
        dst = db.get(PHC, r.destination_phc_id)
        result.append({
            "id": r.id,
            "medicine_id": r.medicine_id,
            "medicine": med.name if med else "Unknown",
            "quantity": r.quantity,
            "status": r.status,
            "source_phc_id": r.source_phc_id,
            "source_phc": src.name if src else "Unknown",
            "destination_phc_id": r.destination_phc_id,
            "destination_phc": dst.name if dst else "Unknown",
            "notes": r.notes,
            "patient_id": r.patient_id,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        })
    return result


@router.post("")
def create_request(
    body: RequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("ASHA", "OFFICER", "ADMIN")),
):
    med = db.get(Medicine, body.medicine_id)
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")
    dst = db.get(PHC, body.destination_phc_id)
    if not dst:
        raise HTTPException(status_code=404, detail="Destination PHC not found")

    req = MedicineRequest(
        patient_id=body.patient_id,
        medicine_id=body.medicine_id,
        source_phc_id=body.source_phc_id,
        destination_phc_id=body.destination_phc_id,
        quantity=body.quantity,
        notes=body.notes,
        requested_by=current_user.id,
    )
    db.add(req)
    db.commit()
    return {"id": req.id, "status": req.status}


@router.put("/{request_id}")
def update_request(
    request_id: int,
    body: RequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("OFFICER", "ADMIN")),
):
    req = db.get(MedicineRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status. Valid values: {', '.join(VALID_STATUSES)}",
        )
    req.status = body.status
    req.updated_at = datetime.utcnow()
    db.commit()
    return {"id": req.id, "status": req.status}
