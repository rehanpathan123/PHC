"""Prototype risk assessment engine.

IMPORTANT: PHC-Sync provides preliminary decision support only.
It does NOT provide a medical diagnosis and does NOT replace a qualified
healthcare professional. All final decisions must remain with licensed
clinical staff.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class VitalSigns:
    symptoms: list[str] = field(default_factory=list)
    temperature: Optional[float] = None
    heart_rate: Optional[int] = None
    spo2: Optional[int] = None
    blood_pressure: Optional[str] = None


def _normalise(text: str) -> str:
    return text.strip().lower()


def assess_risk(vitals: VitalSigns) -> dict:
    """
    Evaluate preliminary risk level based on supplied vitals and symptoms.

    Returns a dict with keys:
        risk_level        : "HIGH" | "MEDIUM" | "LOW"
        risk_score        : int 0-100
        reasons           : list[str]  (human-readable explanations)
        recommended_action: str
    """
    symptoms = [_normalise(s) for s in vitals.symptoms]
    score = 0
    reasons: list[str] = []

    # ── HIGH-risk triggers ─────────────────────────────────────────────────
    if vitals.spo2 is not None and vitals.spo2 < 90:
        score = max(score, 85)
        reasons.append(f"Critical oxygen saturation (SpO₂ {vitals.spo2}%)")

    emergency_keywords = ["unconsciousness", "unconscious", "severe chest pain", "chest pain"]
    if any(kw in symptoms for kw in emergency_keywords):
        score = max(score, 90)
        reasons.append("Emergency symptom reported (chest pain / unconsciousness)")

    if any("breathing" in s or "breath" in s for s in symptoms):
        score = max(score, 80)
        reasons.append("Breathing difficulty reported")

    # Dangerous combination: fever + SpO2 low + breathing difficulty
    if (
        vitals.temperature and vitals.temperature >= 38.5
        and vitals.spo2 is not None and vitals.spo2 < 94
        and any("breath" in s for s in symptoms)
    ):
        score = max(score, 88)
        reasons.append("Dangerous combination: fever + low SpO₂ + breathing difficulty")

    # ── MEDIUM-risk triggers ───────────────────────────────────────────────
    if vitals.temperature is not None and vitals.temperature >= 39.0:
        score = max(score, 60)
        reasons.append(f"High fever ({vitals.temperature}°C)")
    elif vitals.temperature is not None and vitals.temperature >= 38.0:
        score = max(score, 45)
        reasons.append(f"Elevated temperature ({vitals.temperature}°C)")

    if vitals.heart_rate is not None:
        if vitals.heart_rate > 120:
            score = max(score, 58)
            reasons.append(f"Tachycardia — heart rate {vitals.heart_rate} bpm")
        elif vitals.heart_rate < 50:
            score = max(score, 58)
            reasons.append(f"Bradycardia — heart rate {vitals.heart_rate} bpm")

    if vitals.spo2 is not None and 90 <= vitals.spo2 < 94:
        score = max(score, 55)
        reasons.append(f"Low-normal oxygen saturation (SpO₂ {vitals.spo2}%)")

    # Multiple moderate symptoms together
    moderate_count = sum(
        1 for s in symptoms
        if any(kw in s for kw in ["fever", "weakness", "cough", "vomit", "diarrhoea", "diarrhea", "headache"])
    )
    if moderate_count >= 2:
        score = max(score, 42)
        reasons.append(f"{moderate_count} concurrent moderate symptoms")

    # ── LOW-risk triggers ──────────────────────────────────────────────────
    for s in symptoms:
        if any(kw in s for kw in ["fever", "weakness", "cough", "cold", "runny nose"]):
            score = max(score, 30)
            if "Mild symptoms present" not in reasons:
                reasons.append("Mild symptoms present")
            break

    # ── Determine level ────────────────────────────────────────────────────
    level = "HIGH" if score >= 70 else "MEDIUM" if score >= 35 else "LOW"

    action_map = {
        "HIGH": (
            "Urgent clinical evaluation required. Contact PHC medical officer or "
            "emergency services immediately."
        ),
        "MEDIUM": (
            "Clinical review recommended. Patient should be seen by a healthcare "
            "professional within 24 hours."
        ),
        "LOW": (
            "Monitor symptoms closely. Seek professional medical care if symptoms "
            "worsen or new symptoms appear."
        ),
    }

    return {
        "risk_level": level,
        "risk_score": score,
        "reasons": reasons or ["No major warning signs identified from reported vitals"],
        "recommended_action": action_map[level],
    }
