"""Inventory router — view and update medicine stock per PHC."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import User, Inventory, Medicine, PHC
from app.auth import get_current_user, require_roles
from app.schemas import InventoryUpdate
from app.cache import cache_get, cache_set, cache_delete

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


def _status(qty: int, min_stock: int) -> str:
    if qty == 0:
        return "OUT_OF_STOCK"
    if qty <= min_stock:
        return "LOW_STOCK"
    return "AVAILABLE"


@router.get("")
def get_inventory(
    phc_id: int = Query(1, description="PHC to query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"inventory:phc:{phc_id}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    rows = db.execute(
        select(Inventory, Medicine)
        .join(Medicine)
        .where(Inventory.phc_id == phc_id)
        .order_by(Medicine.name)
    ).all()

    result = [
        {
            "id": inv.id,
            "medicine_id": med.id,
            "medicine": med.name,
            "category": med.category,
            "unit": med.unit,
            "quantity": inv.quantity,
            "minimum_stock": inv.minimum_stock,
            "status": _status(inv.quantity, inv.minimum_stock),
            "updated_at": inv.updated_at,
        }
        for inv, med in rows
    ]
    cache_set(cache_key, result, ttl=120)
    return result


@router.get("/all")
def get_all_medicines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all medicines (for medicine selection dropdowns)."""
    medicines = db.scalars(select(Medicine).order_by(Medicine.name)).all()
    return [{"id": m.id, "name": m.name, "category": m.category, "unit": m.unit} for m in medicines]


@router.put("/{inventory_id}")
def update_inventory(
    inventory_id: int,
    body: InventoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("OFFICER", "ADMIN")),
):
    inv = db.get(Inventory, inventory_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory record not found")
    inv.quantity = body.quantity
    if body.minimum_stock is not None:
        inv.minimum_stock = body.minimum_stock
    inv.updated_at = datetime.utcnow()
    db.commit()

    # Bust cache for this PHC
    cache_delete(f"inventory:phc:{inv.phc_id}")
    return {
        "id": inv.id,
        "quantity": inv.quantity,
        "minimum_stock": inv.minimum_stock,
        "status": _status(inv.quantity, inv.minimum_stock),
    }


@router.get("/availability")
def medicine_availability(
    medicine_id: int = Query(...),
    current_phc_id: int = Query(1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Find medicine availability at current PHC and rank nearby PHCs.
    Returns recommended best PHC for transfer request.
    """
    import math

    med = db.get(Medicine, medicine_id)
    if not med:
        raise HTTPException(status_code=404, detail="Medicine not found")

    cur_phc = db.get(PHC, current_phc_id)
    if not cur_phc:
        raise HTTPException(status_code=404, detail="Current PHC not found")

    # Current PHC stock
    cur_inv = db.scalar(
        select(Inventory).where(
            Inventory.phc_id == current_phc_id,
            Inventory.medicine_id == medicine_id,
        )
    )
    cur_qty = cur_inv.quantity if cur_inv else 0

    # All other PHCs that have stock
    rows = db.execute(
        select(Inventory, PHC)
        .join(PHC)
        .where(Inventory.medicine_id == medicine_id, Inventory.quantity > 0)
    ).all()

    def dist(p: PHC) -> float:
        R = 6371
        pi = math.pi / 180
        dlat = (p.latitude - cur_phc.latitude) * pi
        dlon = (p.longitude - cur_phc.longitude) * pi
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(cur_phc.latitude * pi) * math.cos(p.latitude * pi) * math.sin(dlon / 2) ** 2
        )
        return round(2 * R * math.asin(math.sqrt(a)), 1)

    nearby = sorted(
        [
            {
                "id": phc.id,
                "name": phc.name,
                "address": phc.address,
                "latitude": phc.latitude,
                "longitude": phc.longitude,
                "available_quantity": inv.quantity,
                "distance_km": dist(phc),
                "status": _status(inv.quantity, inv.minimum_stock),
            }
            for inv, phc in rows
            if phc.id != current_phc_id
        ],
        key=lambda x: (x["distance_km"], -x["available_quantity"]),
    )

    return {
        "medicine_id": med.id,
        "medicine": med.name,
        "unit": med.unit,
        "current_phc_id": current_phc_id,
        "current_phc_name": cur_phc.name,
        "current_phc_available": cur_qty > 0,
        "current_quantity": cur_qty,
        "recommended_phc": nearby[0] if nearby else None,
        "nearby_phcs": nearby,
    }
