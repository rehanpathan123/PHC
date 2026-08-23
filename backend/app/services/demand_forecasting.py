from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models import Assessment, Inventory, Medicine, PHC

# Default consumption rate if no database history is present
DEFAULT_DAILY_DEMAND = 5.0


def calculate_average_daily_demand(db: Session, medicine_name: str, phc_id: int, days_lookback: int = 14) -> float:
    """
    Calculate average daily demand of a medicine at a PHC based on recent assessments.
    Falls back to a default rate if there is no historical data.
    """
    cutoff = datetime.utcnow() - timedelta(days=days_lookback)
    # Query assessments at this PHC requesting this medicine in the lookback period
    stmt = (
        select(func.count(Assessment.id))
        .join(Assessment.patient)
        .where(
            Assessment.required_medicine == medicine_name,
            Assessment.created_at >= cutoff,
            Assessment.patient.has(phc_id=phc_id)
        )
    )
    count = db.scalar(stmt) or 0
    if count > 0:
        return round(max(float(count) / days_lookback, 0.5), 2)

    # Let's check total historical count if lookback is 0
    stmt_total = (
        select(func.count(Assessment.id))
        .join(Assessment.patient)
        .where(
            Assessment.required_medicine == medicine_name,
            Assessment.patient.has(phc_id=phc_id)
        )
    )
    total_count = db.scalar(stmt_total) or 0
    if total_count > 0:
        # Calculate days since first assessment
        stmt_first = (
            select(Assessment.created_at)
            .join(Assessment.patient)
            .where(
                Assessment.required_medicine == medicine_name,
                Assessment.patient.has(phc_id=phc_id)
            )
            .order_by(Assessment.created_at.asc())
            .limit(1)
        )
        first_date = db.scalar(stmt_first)
        if first_date:
            days = (datetime.utcnow() - first_date).days
            days = max(days, 1)
            return round(max(float(total_count) / days, 0.5), 2)

    return DEFAULT_DAILY_DEMAND


def forecast_demand(db: Session, phc_id: int, medicine_id: int) -> dict:
    """
    Perform a weighted moving average or simple forecast for next 7/14 days.
    Returns forecasted demand, stock-out risk, and reorder recommendation.
    """
    med = db.get(Medicine, medicine_id)
    if not med:
        return {}

    # Get current stock
    inv = db.scalar(
        select(Inventory).where(
            Inventory.phc_id == phc_id,
            Inventory.medicine_id == medicine_id,
        )
    )
    current_stock = inv.quantity if inv else 0
    min_stock = inv.minimum_stock if inv else 10

    # Calculate average daily demand
    daily_demand = calculate_average_daily_demand(db, med.name, phc_id)

    # Predictions
    pred_7 = int(round(daily_demand * 7))
    pred_14 = int(round(daily_demand * 14))

    # Risk level & reorder
    if current_stock == 0:
        risk = "HIGH"
        reorder = pred_7 + min_stock
    elif current_stock < pred_7:
        risk = "HIGH"
        reorder = (pred_7 - current_stock) + min_stock
    elif current_stock < pred_14:
        risk = "MEDIUM"
        reorder = (pred_14 - current_stock) + min_stock
    else:
        risk = "LOW"
        reorder = 0

    return {
        "medicine_id": med.id,
        "medicine": med.name,
        "current_stock": current_stock,
        "predicted_7_day_demand": pred_7,
        "predicted_14_day_demand": pred_14,
        "stockout_risk": risk,
        "recommended_reorder_quantity": reorder,
    }
