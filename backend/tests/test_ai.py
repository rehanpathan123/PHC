import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Mock the ollama service responses so we don't need a running Ollama container for unit tests
@pytest.fixture
def mock_ollama():
    with patch("app.services.ollama_service.generate") as mock_gen, \
         patch("app.services.ollama_service.generate_json") as mock_json, \
         patch("app.services.ollama_service.is_ollama_ready") as mock_ready:
        
        mock_ready.return_value = True
        mock_gen.return_value = "Mocked AI response text"
        mock_json.return_value = {
            "fever": True,
            "fever_duration_days": 3,
            "cough": True,
            "breathing_difficulty": True,
            "chest_pain": False,
            "weakness": True,
            "vomiting": False,
            "other_symptoms": ["headache"]
        }
        yield {
            "generate": mock_gen,
            "generate_json": mock_json,
            "is_ollama_ready": mock_ready
        }


def test_ai_status(client, asha_token, mock_ollama):
    headers = {"Authorization": f"Bearer {asha_token}"}
    resp = client.get("/api/ai/status", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is True
    assert "llama3.2" in data["model"]


def test_symptom_extraction_ai(client, asha_token, mock_ollama):
    headers = {"Authorization": f"Bearer {asha_token}"}
    payload = {"text": "Patient has 3 days fever, cough and breathing problems."}
    resp = client.post("/api/ai/extract-symptoms", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["fever"] is True
    assert data["fever_duration_days"] == 3
    assert data["breathing_difficulty"] is True
    assert "headache" in data["other_symptoms"]


def test_symptom_extraction_fallback(client, asha_token):
    # Test symptom extraction when Ollama is offline / returns None
    with patch("app.services.ollama_service.extract_symptoms", return_value=None):
        headers = {"Authorization": f"Bearer {asha_token}"}
        payload = {"text": "bukhar and breathing problems"}
        resp = client.post("/api/ai/extract-symptoms", json=payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["fever"] is True
        assert data["breathing_difficulty"] is True
        assert data["cough"] is False


def test_patient_summary(client, asha_token, mock_ollama):
    headers = {"Authorization": f"Bearer {asha_token}"}
    payload = {
        "age": 65,
        "symptoms": ["fever", "cough"],
        "temperature": 39.2,
        "spo2": 88,
        "heart_rate": 110,
        "risk_level": "HIGH"
    }
    resp = client.post("/api/ai/patient-summary", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "summary" in data
    assert data["summary"] == "Mocked AI response text"


def test_risk_explanation(client, asha_token, mock_ollama):
    headers = {"Authorization": f"Bearer {asha_token}"}
    mock_ollama["generate_json"].return_value = {
        "risk_level": "HIGH",
        "risk_score": 91,
        "explanation": [
            "Oxygen saturation is low.",
            "Patient reported breathing difficulty."
        ],
        "recommended_urgency": "URGENT"
    }
    payload = {
        "risk_level": "HIGH",
        "risk_score": 91,
        "reasons": ["Low oxygen saturation"],
        "age": 65,
        "symptoms": ["breathing difficulty"]
    }
    resp = client.post("/api/ai/risk-explanation", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["recommended_urgency"] == "URGENT"
    assert len(data["explanation"]) == 2


def test_demand_forecast(client, officer_token, mock_ollama):
    headers = {"Authorization": f"Bearer {officer_token}"}
    resp = client.get("/api/ai/demand-forecast?phc_id=1&medicine_id=1", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "predicted_7_day_demand" in data
    assert "explanation" in data
    assert data["explanation"] == "Mocked AI response text"


def test_stockout_alerts(client, officer_token):
    headers = {"Authorization": f"Bearer {officer_token}"}
    resp = client.get("/api/ai/stockout-alerts?phc_id=1", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_anomalies(client, officer_token, mock_ollama):
    headers = {"Authorization": f"Bearer {officer_token}"}
    resp = client.get("/api/ai/anomalies?phc_id=1", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert data[0]["anomaly"] is True
    assert "explanation" in data[0]


def test_copilot_high_risk_patients(client, officer_token, mock_ollama):
    headers = {"Authorization": f"Bearer {officer_token}"}
    payload = {"question": "Are there any high risk patients today?"}
    resp = client.post("/api/ai/copilot", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["answer"] == "Mocked AI response text"
    assert "high_risk_patients" in data["context_used"]


def test_copilot_stockout(client, officer_token, mock_ollama):
    headers = {"Authorization": f"Bearer {officer_token}"}
    payload = {"question": "Which medicines will run out?"}
    resp = client.post("/api/ai/copilot", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "stockout_risks" in data["context_used"]
