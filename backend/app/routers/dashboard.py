"""Dashboard router — analytics stats for all roles."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User, Patient, Assessment, Inventory, MedicineRequest, PHC, SyncLog
from app.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Patient & assessment counts
    total_patients = db.scalar(select(func.count()).select_from(Patient)) or 0
    assessments = db.scalars(select(Assessment)).all()
    risk_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
    for a in assessments:
        risk_counts[a.risk_level] = risk_counts.get(a.risk_level, 0) + 1

    # Inventory stats
    inventory = db.scalars(select(Inventory)).all()
    low_stock = sum(1 for i in inventory if 0 < i.quantity <= i.minimum_stock)
    out_of_stock = sum(1 for i in inventory if i.quantity == 0)

    # Request stats
    requests = db.scalars(select(MedicineRequest)).all()
    req_by_status = {}
    for r in requests:
        req_by_status[r.status] = req_by_status.get(r.status, 0) + 1

    # Sync failures
    sync_failures = db.scalar(
        select(func.count()).select_from(SyncLog).where(SyncLog.status == "FAILED")
    ) or 0

    return {
        "total_patients": total_patients,
        "total_users": db.scalar(select(func.count()).select_from(User)) or 0,
        "total_phcs": db.scalar(select(func.count()).select_from(PHC)) or 0,
        "total_assessments": len(assessments),
        "risk": risk_counts,
        "inventory": {
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
            "total_items": len(inventory),
        },
        "requests": req_by_status,
        "pending_requests": req_by_status.get("PENDING", 0),
        "sync_failures": sync_failures,
    }
