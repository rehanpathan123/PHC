"""Demo seed data — runs once on startup if database is empty."""
import json
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models import User, PHC, Medicine, Inventory, Patient, Assessment
from app.auth import hash_password


DEMO_USERS = [
    ("Priya Sharma",  "asha@phcsync.demo",    "9876543210", "ASHA",    1),
    ("Dr. Ramesh Patel", "officer@phcsync.demo", "9876543211", "OFFICER", 1),
    ("Admin User",    "admin@phcsync.demo",   "9876543212", "ADMIN",   None),
]

# Gujarat coordinates
DEMO_PHCS = [
    ("PHC Kheda Central",  "Kheda Village, Gujarat", 22.7500, 72.6833, "PHC A - Demo District"),
    ("PHC Rampur",         "Rampur Road, Gujarat",   22.7700, 72.7033, "PHC A - Demo District"),
    ("PHC Navagam",        "Navagam, Gujarat",        22.7400, 72.7233, "PHC A - Demo District"),
    ("PHC Sundarpur",      "Sundarpur, Gujarat",      22.7300, 72.6633, "PHC A - Demo District"),
    ("PHC Shantinagar",    "Shantinagar, Gujarat",    22.7800, 72.6533, "PHC A - Demo District"),
]

DEMO_MEDICINES = [
    ("Paracetamol 500mg",    "Antipyretic",   "tablets"),
    ("ORS Sachets",          "Rehydration",   "sachets"),
    ("Salbutamol Inhaler",   "Respiratory",   "units"),
    ("Amoxicillin 500mg",    "Antibiotic",    "capsules"),
    ("Metformin 500mg",      "Antidiabetic",  "tablets"),
    ("Amlodipine 5mg",       "Antihypertensive", "tablets"),
]

# (phc_index, medicine_index, quantity)
# PHC A (index 0) has 0 Salbutamol Inhalers → OUT OF STOCK
# PHC B (index 1) has 35 → AVAILABLE
INVENTORY_OVERRIDES = {
    (0, 2): 0,    # PHC A, Salbutamol → 0
    (1, 2): 35,   # PHC B, Salbutamol → 35
    (2, 2): 20,   # PHC C, Salbutamol → 20
    (0, 0): 5,    # PHC A, Paracetamol → LOW STOCK (min is 10)
}


def run_seed(db: Session):
    """Insert demo data if the users table is empty."""
    if db.scalar(select(User).limit(1)):
        return  # already seeded

    # ── Users ──
    users = []
    for name, email, phone, role, phc_idx in DEMO_USERS:
        u = User(
            name=name,
            email=email,
            phone=phone,
            password_hash=hash_password("Demo@123"),
            role=role,
        )
        db.add(u)
        users.append(u)

    # ── PHCs ──
    phc_objects = []
    for name, address, lat, lon, district in DEMO_PHCS:
        p = PHC(name=name, address=address, latitude=lat, longitude=lon,
                contact="1800-000-1000", district=district)
        db.add(p)
        phc_objects.append(p)

    db.flush()  # get IDs

    # Assign PHC officer to first PHC
    users[0].phc_id = phc_objects[0].id   # ASHA worker
    users[1].phc_id = phc_objects[0].id   # PHC officer

    # ── Medicines ──
    med_objects = []
    for name, cat, unit in DEMO_MEDICINES:
        m = Medicine(name=name, category=cat, unit=unit)
        db.add(m)
        med_objects.append(m)

    db.flush()

    # ── Inventory ──
    for pi, phc in enumerate(phc_objects):
        for mi, med in enumerate(med_objects):
            default_qty = 60
            qty = INVENTORY_OVERRIDES.get((pi, mi), default_qty)
            db.add(Inventory(
                phc_id=phc.id,
                medicine_id=med.id,
                quantity=qty,
                minimum_stock=10,
            ))

    db.commit()
    print("✅ PHC-Sync demo data seeded successfully.")
