"""PHC router — list all PHCs, get nearby PHCs with haversine distance."""
import math
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User, PHC, Inventory, Medicine
from app.auth import get_current_user

router = APIRouter(prefix="/api/phcs", tags=["phcs"])


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in km."""
    R = 6371
    p = math.pi / 180
    dlat = (lat2 - lat1) * p
    dlon = (lon2 - lon1) * p
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(dlon / 2) ** 2
    )
    return round(2 * R * math.asin(math.sqrt(a)), 1)


def _phc_dict(phc: PHC, distance_km: float | None = None) -> dict:
    d = {
        "id": phc.id,
        "name": phc.name,
        "address": phc.address,
        "latitude": phc.latitude,
        "longitude": phc.longitude,
        "contact": phc.contact,
        "district": phc.district,
    }
    if distance_km is not None:
        d["distance_km"] = distance_km
    return d


@router.get("")
def list_phcs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    phcs = db.scalars(select(PHC)).all()
    return [_phc_dict(p) for p in phcs]


@router.get("/nearby")
def nearby_phcs(
    lat: float = Query(..., description="Reference latitude"),
    lon: float = Query(..., description="Reference longitude"),
    radius_km: float = Query(50, description="Search radius in km"),
    medicine_id: int | None = Query(None, description="Filter by medicine availability"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    phcs = db.scalars(select(PHC)).all()
    results = []
    for phc in phcs:
        dist = _haversine(lat, lon, phc.latitude, phc.longitude)
        if dist > radius_km:
            continue
        entry = _phc_dict(phc, dist)

        # Optionally attach medicine stock
        if medicine_id:
            inv = db.scalar(
                select(Inventory).where(
                    Inventory.phc_id == phc.id,
                    Inventory.medicine_id == medicine_id,
                )
            )
            if inv:
                entry["medicine_quantity"] = inv.quantity
                entry["medicine_status"] = (
                    "OUT_OF_STOCK" if inv.quantity == 0
                    else "LOW_STOCK" if inv.quantity <= inv.minimum_stock
                    else "AVAILABLE"
                )
            else:
                entry["medicine_quantity"] = 0
                entry["medicine_status"] = "NOT_LISTED"

        results.append(entry)

    results.sort(key=lambda x: x.get("distance_km", 0))
    return results
