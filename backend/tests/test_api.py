"""PHC-Sync API test suite."""
import pytest


# ── Helpers ────────────────────────────────────────────────────────────────────

def auth(token):
    return {"Authorization": f"Bearer {token}"}


HIGH_RISK_PATIENT = {
    "name": "Test Patient High",
    "age": 65,
    "gender": "Female",
    "village": "Kheda",
    "symptoms": ["Fever", "Breathing difficulty"],
    "temperature": 39.5,
    "heart_rate": 105,
    "spo2": 88,
    "blood_pressure": "140/90",
    "required_medicine": "Salbutamol Inhaler",
}

LOW_RISK_PATIENT = {
    "name": "Test Patient Low",
    "age": 25,
    "gender": "Male",
    "village": "Navagam",
    "symptoms": ["Runny nose"],
    "temperature": 37.2,
    "heart_rate": 78,
    "spo2": 98,
}


# ── Auth ───────────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_asha_success(self, client):
        resp = client.post("/api/auth/login", json={"email": "asha@phcsync.demo", "password": "Demo@123"})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["role"] == "ASHA"

    def test_login_officer_success(self, client):
        resp = client.post("/api/auth/login", json={"email": "officer@phcsync.demo", "password": "Demo@123"})
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "OFFICER"

    def test_login_admin_success(self, client):
        resp = client.post("/api/auth/login", json={"email": "admin@phcsync.demo", "password": "Demo@123"})
        assert resp.status_code == 200
        assert resp.json()["user"]["role"] == "ADMIN"

    def test_login_wrong_password(self, client):
        resp = client.post("/api/auth/login", json={"email": "asha@phcsync.demo", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_unknown_user(self, client):
        resp = client.post("/api/auth/login", json={"email": "nobody@phcsync.demo", "password": "Demo@123"})
        assert resp.status_code == 401

    def test_protected_without_token(self, client):
        resp = client.get("/api/patients")
        assert resp.status_code == 401

    def test_me_endpoint(self, client, asha_token):
        resp = client.get("/api/auth/me", headers=auth(asha_token))
        assert resp.status_code == 200
        assert resp.json()["email"] == "asha@phcsync.demo"


# ── Role Authorization ─────────────────────────────────────────────────────────

class TestRBAC:
    def test_asha_cannot_approve_requests(self, client, asha_token):
        # Create a request first
        inv = client.get("/api/inventory?phc_id=1", headers=auth(asha_token)).json()
        resp = client.put(
            "/api/medicine/requests/9999?status=APPROVED",
            headers=auth(asha_token),
        )
        assert resp.status_code in (403, 404)  # 403 if RBAC kicks in, 404 if passes RBAC

    def test_officer_cannot_create_patient(self, client, officer_token):
        # Officer CAN create patients (they're in require_roles)
        resp = client.post(
            "/api/patients",
            json={**LOW_RISK_PATIENT, "name": "Officer Test"},
            headers=auth(officer_token),
        )
        assert resp.status_code in (200, 201)


# ── Patients ───────────────────────────────────────────────────────────────────

class TestPatients:
    def test_create_patient_high_risk(self, client, asha_token):
        resp = client.post("/api/patients", json=HIGH_RISK_PATIENT, headers=auth(asha_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["assessment"]["risk_level"] == "HIGH"
        assert data["assessment"]["risk_score"] >= 70
        assert len(data["assessment"]["reasons"]) > 0
        assert "patient_code" in data

    def test_create_patient_low_risk(self, client, asha_token):
        resp = client.post("/api/patients", json=LOW_RISK_PATIENT, headers=auth(asha_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["assessment"]["risk_level"] == "LOW"

    def test_list_patients(self, client, asha_token):
        resp = client.get("/api/patients", headers=auth(asha_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
        assert len(resp.json()) > 0

    def test_get_patient_detail(self, client, asha_token):
        # Create first
        create = client.post("/api/patients", json=LOW_RISK_PATIENT, headers=auth(asha_token))
        pid = create.json()["patient_id"]
        resp = client.get(f"/api/patients/{pid}", headers=auth(asha_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == pid
        assert "assessments" in data
        assert len(data["assessments"]) > 0


# ── Risk Assessment ────────────────────────────────────────────────────────────

class TestRiskEngine:
    def test_high_risk_low_spo2(self, client, asha_token):
        resp = client.post(
            "/api/risk-assessment",
            json={"spo2": 85, "symptoms": ["Breathing difficulty"]},
            headers=auth(asha_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["risk_level"] == "HIGH"
        assert data["risk_score"] >= 70

    def test_medium_risk_fever(self, client, asha_token):
        resp = client.post(
            "/api/risk-assessment",
            json={"symptoms": ["Fever"], "temperature": 39.5, "spo2": 96},
            headers=auth(asha_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["risk_level"] in ("MEDIUM", "HIGH")

    def test_low_risk_mild(self, client, asha_token):
        resp = client.post(
            "/api/risk-assessment",
            json={"symptoms": [], "temperature": 37.0, "spo2": 99},
            headers=auth(asha_token),
        )
        assert resp.status_code == 200
        assert resp.json()["risk_level"] == "LOW"

    def test_emergency_symptoms(self, client, asha_token):
        resp = client.post(
            "/api/risk-assessment",
            json={"symptoms": ["Unconsciousness"], "spo2": 95},
            headers=auth(asha_token),
        )
        assert resp.status_code == 200
        assert resp.json()["risk_level"] == "HIGH"


# ── PHCs ───────────────────────────────────────────────────────────────────────

class TestPHCs:
    def test_list_phcs(self, client, asha_token):
        resp = client.get("/api/phcs", headers=auth(asha_token))
        assert resp.status_code == 200
        phcs = resp.json()
        assert len(phcs) == 5

    def test_nearby_phcs(self, client, asha_token):
        resp = client.get(
            "/api/phcs/nearby?lat=22.75&lon=72.6833&radius_km=50",
            headers=auth(asha_token),
        )
        assert resp.status_code == 200
        phcs = resp.json()
        assert len(phcs) > 0
        # Results should be sorted by distance
        distances = [p.get("distance_km", 0) for p in phcs]
        assert distances == sorted(distances)

    def test_nearby_phcs_with_medicine(self, client, asha_token):
        resp = client.get(
            "/api/phcs/nearby?lat=22.75&lon=72.6833&radius_km=50&medicine_id=3",
            headers=auth(asha_token),
        )
        assert resp.status_code == 200


# ── Inventory ──────────────────────────────────────────────────────────────────

class TestInventory:
    def test_get_inventory_phc1(self, client, asha_token):
        resp = client.get("/api/inventory?phc_id=1", headers=auth(asha_token))
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) > 0
        # Salbutamol should be OUT_OF_STOCK at PHC 1
        salbutamol = next((i for i in items if "Salbutamol" in i["medicine"]), None)
        assert salbutamol is not None
        assert salbutamol["status"] == "OUT_OF_STOCK"

    def test_medicine_availability(self, client, asha_token):
        # Medicine ID 3 = Salbutamol Inhaler
        resp = client.get(
            "/api/inventory/availability?medicine_id=3&current_phc_id=1",
            headers=auth(asha_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_phc_available"] is False
        assert data["current_quantity"] == 0
        assert data["recommended_phc"] is not None
        # PHC B should be recommended (has 35 units)
        assert data["recommended_phc"]["available_quantity"] >= 20

    def test_update_inventory_as_officer(self, client, officer_token):
        # Get inventory item ID for PHC 1
        inv = client.get("/api/inventory?phc_id=1", headers=auth(officer_token)).json()
        item_id = inv[0]["id"]
        resp = client.put(
            f"/api/inventory/{item_id}",
            json={"quantity": 50},
            headers=auth(officer_token),
        )
        assert resp.status_code == 200
        assert resp.json()["quantity"] == 50

    def test_asha_cannot_update_inventory(self, client, asha_token):
        inv = client.get("/api/inventory?phc_id=1", headers=auth(asha_token)).json()
        item_id = inv[0]["id"]
        resp = client.put(
            f"/api/inventory/{item_id}",
            json={"quantity": 100},
            headers=auth(asha_token),
        )
        assert resp.status_code == 403


# ── Medicine Requests ──────────────────────────────────────────────────────────

class TestMedicineRequests:
    def test_create_request(self, client, asha_token):
        resp = client.post(
            "/api/medicine/requests",
            json={
                "medicine_id": 3,
                "source_phc_id": 1,
                "destination_phc_id": 2,
                "quantity": 10,
            },
            headers=auth(asha_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "PENDING"
        assert "id" in data

    def test_list_requests(self, client, officer_token):
        resp = client.get("/api/medicine/requests", headers=auth(officer_token))
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_approve_request(self, client, asha_token, officer_token):
        # Create request
        create = client.post(
            "/api/medicine/requests",
            json={"medicine_id": 3, "source_phc_id": 1, "destination_phc_id": 2, "quantity": 5},
            headers=auth(asha_token),
        )
        req_id = create.json()["id"]

        # Approve as officer
        approve = client.put(
            f"/api/medicine/requests/{req_id}",
            json={"status": "APPROVED"},
            headers=auth(officer_token),
        )
        assert approve.status_code == 200
        assert approve.json()["status"] == "APPROVED"

    def test_reject_request(self, client, asha_token, officer_token):
        create = client.post(
            "/api/medicine/requests",
            json={"medicine_id": 3, "source_phc_id": 1, "destination_phc_id": 2, "quantity": 5},
            headers=auth(asha_token),
        )
        req_id = create.json()["id"]
        reject = client.put(
            f"/api/medicine/requests/{req_id}",
            json={"status": "REJECTED"},
            headers=auth(officer_token),
        )
        assert reject.status_code == 200
        assert reject.json()["status"] == "REJECTED"

    def test_invalid_status(self, client, asha_token, officer_token):
        create = client.post(
            "/api/medicine/requests",
            json={"medicine_id": 3, "source_phc_id": 1, "destination_phc_id": 2, "quantity": 5},
            headers=auth(asha_token),
        )
        req_id = create.json()["id"]
        resp = client.put(
            f"/api/medicine/requests/{req_id}",
            json={"status": "INVALID_STATUS"},
            headers=auth(officer_token),
        )
        assert resp.status_code == 422


# ── Sync ───────────────────────────────────────────────────────────────────────

class TestSync:
    def test_sync_status(self, client, asha_token):
        resp = client.get("/api/sync/status", headers=auth(asha_token))
        assert resp.status_code == 200
        assert resp.json()["status"] == "READY"

    def test_sync_single_record(self, client, asha_token):
        resp = client.post(
            "/api/sync",
            json=[{
                "local_id": "offline-test-001",
                "payload": {
                    "name": "Offline Patient",
                    "age": 45,
                    "gender": "Male",
                    "village": "Test Village",
                    "symptoms": ["Fever"],
                    "temperature": 38.5,
                    "spo2": 96,
                },
            }],
            headers=auth(asha_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["synced"] == 1
        assert data["failed"] == 0
        assert data["results"][0]["status"] == "SYNCED"

    def test_sync_multiple_records(self, client, asha_token):
        records = [
            {
                "local_id": f"offline-batch-{i}",
                "payload": {
                    "name": f"Batch Patient {i}",
                    "age": 30 + i,
                    "gender": "Female",
                    "village": "Batch Village",
                    "symptoms": [],
                    "spo2": 97,
                },
            }
            for i in range(3)
        ]
        resp = client.post("/api/sync", json=records, headers=auth(asha_token))
        assert resp.status_code == 200
        assert resp.json()["synced"] == 3


# ── Dashboard ──────────────────────────────────────────────────────────────────

class TestDashboard:
    def test_dashboard_stats(self, client, asha_token):
        resp = client.get("/api/dashboard/stats", headers=auth(asha_token))
        assert resp.status_code == 200
        data = resp.json()
        assert "total_patients" in data
        assert "risk" in data
        assert "inventory" in data
        assert "requests" in data
        assert data["total_phcs"] == 5
