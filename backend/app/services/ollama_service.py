import os
import json
import time
import logging
from typing import Optional, Any
import httpx
from app.db import SessionLocal
from app.models import AiLog
from app.ai.prompts import (
    symptom_extraction,
    patient_summary,
    risk_explanation,
    phc_recommendation,
    inventory_explanation,
    copilot,
)

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "120"))


def log_ai_interaction(
    user_id: Optional[int],
    feature: str,
    request_type: str,
    success: bool,
    latency_ms: int,
    error_message: Optional[str] = None,
):
    """Log the AI interaction safely to the DB in a separate session."""
    db = SessionLocal()
    try:
        log = AiLog(
            user_id=user_id,
            feature=feature,
            model=OLLAMA_MODEL,
            request_type=request_type,
            success=success,
            latency_ms=latency_ms,
            error_message=error_message,
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error("Failed to write AI log to DB: %s", e)
        db.rollback()
    finally:
        db.close()


def generate(prompt: str, system: Optional[str] = None, user_id: Optional[int] = None, feature: str = "general") -> Optional[str]:
    """Call Ollama generation API with timeout and retries."""
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system

    start_time = time.time()
    retries = 1
    error_msg = None

    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                text = data.get("response", "").strip()
                latency = int((time.time() - start_time) * 1000)
                log_ai_interaction(user_id, feature, "text", True, latency)
                return text
        except Exception as e:
            error_msg = str(e)
            logger.warning("Ollama generate attempt %d failed: %s", attempt + 1, e)
            if attempt == retries:
                break
            time.sleep(0.5)

    latency = int((time.time() - start_time) * 1000)
    log_ai_interaction(user_id, feature, "text", False, latency, error_msg)
    return None


def generate_json(prompt: str, system: Optional[str] = None, user_id: Optional[int] = None, feature: str = "general") -> Optional[dict]:
    """Call Ollama generation API expecting JSON format."""
    url = f"{OLLAMA_BASE_URL}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
    }
    if system:
        payload["system"] = system

    start_time = time.time()
    retries = 1
    error_msg = None

    for attempt in range(retries + 1):
        try:
            with httpx.Client(timeout=OLLAMA_TIMEOUT) as client:
                resp = client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                text = data.get("response", "").strip()
                parsed = json.loads(text)
                latency = int((time.time() - start_time) * 1000)
                log_ai_interaction(user_id, feature, "json", True, latency)
                return parsed
        except (json.JSONDecodeError, httpx.HTTPError, Exception) as e:
            error_msg = str(e)
            logger.warning("Ollama generate_json attempt %d failed: %s", attempt + 1, e)
            if attempt == retries:
                break
            time.sleep(0.5)

    latency = int((time.time() - start_time) * 1000)
    log_ai_interaction(user_id, feature, "json", False, latency, error_msg)
    return None


# ── Feature Methods ───────────────────────────────────────────────────────────

def extract_symptoms(text: str, user_id: Optional[int] = None) -> Optional[dict]:
    """Extract structured symptoms from text/transcript using Ollama."""
    prompt = symptom_extraction.USER_PROMPT_TEMPLATE.format(text=text)
    system = symptom_extraction.SYSTEM_PROMPT
    return generate_json(prompt, system=system, user_id=user_id, feature="symptom_extraction")


def generate_patient_summary(patient_data: dict, user_id: Optional[int] = None) -> Optional[str]:
    """Generate concise professional summary of the patient."""
    prompt = patient_summary.USER_PROMPT_TEMPLATE.format(
        age=patient_data.get("age", "Unknown"),
        symptoms=", ".join(patient_data.get("symptoms", [])),
        temperature=patient_data.get("temperature", "Unknown"),
        heart_rate=patient_data.get("heart_rate", "Unknown"),
        spo2=patient_data.get("spo2", "Unknown"),
        risk_level=patient_data.get("risk_level", "Unknown"),
    )
    system = patient_summary.SYSTEM_PROMPT
    return generate(prompt, system=system, user_id=user_id, feature="patient_summary")


def generate_risk_explanation(
    risk_level: str,
    risk_score: int,
    reasons: list[str],
    age: int,
    symptoms: list[str],
    user_id: Optional[int] = None,
) -> Optional[dict]:
    """Explain risk assessment reasons calculated by backend rules."""
    prompt = risk_explanation.USER_PROMPT_TEMPLATE.format(
        risk_level=risk_level,
        risk_score=risk_score,
        reasons=json.dumps(reasons),
        age=age,
        symptoms=", ".join(symptoms),
    )
    system = risk_explanation.SYSTEM_PROMPT
    return generate_json(prompt, system=system, user_id=user_id, feature="risk_explanation")


def generate_phc_recommendation_explanation(
    recommended_phc_name: str,
    distance: float,
    workload: str,
    medicine_name: str,
    options_details: str,
    user_id: Optional[int] = None,
) -> Optional[str]:
    """Explain the PHC transfer recommendation score details."""
    prompt = phc_recommendation.USER_PROMPT_TEMPLATE.format(
        recommended_phc_name=recommended_phc_name,
        distance=distance,
        workload=workload,
        medicine_name=medicine_name,
        options_details=options_details,
    )
    system = phc_recommendation.SYSTEM_PROMPT
    return generate(prompt, system=system, user_id=user_id, feature="phc_recommendation")


def generate_inventory_explanation(
    context_type: str,
    details: str,
    user_id: Optional[int] = None,
) -> Optional[str]:
    """Explain forecast or anomalies to the medical officer."""
    prompt = inventory_explanation.USER_PROMPT_TEMPLATE.format(
        context_type=context_type,
        details=details,
    )
    system = inventory_explanation.SYSTEM_PROMPT
    return generate(prompt, system=system, user_id=user_id, feature="inventory_explanation")


def answer_copilot_question(
    question: str,
    context_data: dict,
    user_id: Optional[int] = None,
) -> Optional[str]:
    """Ground LLM Copilot response strictly in actual backend statistics/context."""
    prompt = copilot.USER_PROMPT_TEMPLATE.format(
        context_data=json.dumps(context_data, indent=2),
        question=question,
    )
    system = copilot.SYSTEM_PROMPT
    return generate(prompt, system=system, user_id=user_id, feature="copilot")


def translate_healthcare_text(text: str, target_lang: str, user_id: Optional[int] = None) -> Optional[str]:
    """Translate healthcare instructions or response to the target language (e.g. Hindi)."""
    system = f"You are a translator. Translate the input medical text to {target_lang}. Keep it simple and easy to understand. Only return the translated text."
    return generate(f"Translate: {text}", system=system, user_id=user_id, feature="translation")


def is_ollama_ready() -> bool:
    """Check if Ollama server is reachable and configured model is pulled."""
    try:
        with httpx.Client(timeout=3) as client:
            # Check server
            resp = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                models = [m.get("name") for m in resp.json().get("models", [])]
                # Look for model name match (some pulled models have :latest or tags)
                return any(OLLAMA_MODEL in m for m in models) or len(models) > 0
            return False
    except Exception:
        return False
