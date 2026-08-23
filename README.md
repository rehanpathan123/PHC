# PHC-Sync

PHC-Sync is an offline-first primary-healthcare decision-support prototype for ASHA workers and PHCs. It performs transparent, rule-based preliminary risk assessment and helps locate medicine stock across nearby PHCs. It does **not** diagnose conditions or prescribe treatment.

## What works

- ASHA, PHC Officer, and Admin demo login with JWT role protection
- Patient registration, vitals, symptom capture, and risk levels (LOW / MEDIUM / HIGH)
- Medicine availability matching from current and nearby seeded PHCs
- Transfer-request creation and officer approval/rejection
- Responsive healthcare dashboard populated from API data
- Offline patient records saved to IndexedDB, preserving failed/pending records until successful sync
- PostgreSQL and Redis service configuration for deployment; SQLite fallback for simple local demo use

## Run locally

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The server seeds itself on first start.

Demo password for all accounts: `Demo@123`

- ASHA: `asha@phcsync.demo`
- PHC Officer: `officer@phcsync.demo`
- Admin: `admin@phcsync.demo`

## Docker

```bash
docker compose up --build
```

Run the frontend locally as above. Copy `backend/.env.example` and `frontend/.env.example` for non-demo deployments; replace the JWT secret and demo password.

## Architecture

React/Vite is the mobile-first client. Its service layer calls FastAPI REST APIs. Dexie/IndexedDB contains locally created records and only changes them to `SYNCED` after backend acknowledgement. FastAPI uses SQLAlchemy models compatible with PostgreSQL (and defaults to SQLite for local setup). Redis is configured as an optional inventory cache service; database reads remain the safe fallback.

## Demo flow

Sign in as ASHA, register a 65-year-old patient with Fever, Breathing difficulty, and SpO₂ 88. The assessment returns HIGH risk and an urgent-evaluation notice. Select **Salbutamol Inhaler**, check availability, and create a request to PHC B. Sign in as PHC Officer to approve it. Disable network before saving another patient to see Offline Mode, then reconnect and select Sync now.

## Safety and limitations

The scoring rules are demonstrative only and are not clinically validated. The prototype does not provide medical diagnosis, prescription dosages, or automatic physical medicine delivery.

## Local AI Integration (Ollama)

PHC-Sync integrates a local AI decision-support layer using **Ollama** for language understanding, symptom extraction, forecasting explanations, patient summaries, and conversational copilot support.

### Ollama Setup Instructions
1. Install [Ollama](https://ollama.com) on your system.
2. Start the Ollama application.
3. Download the default model in your terminal:
   ```bash
   ollama pull llama3.2:3b
   ```
4. Verify Ollama is running on `http://localhost:11434`.

### AI Configuration (.env)
Update your `.env` variables to customize the local AI settings:
```env
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT=120
```

### AI Failure & Offline Fallback
Ollama is a progress-improvement tool, not a blocker. If Ollama is offline or the model is not pulled, **PHC-Sync continues to function normally**:
- The ASHA patient register uses deterministic local clinical rule engines to calculate risk scores and recommended urgency.
- The Voice intake falls back to regex-based keywords for Hindi/Hinglish/English.
- AI Health Intelligence displays clear warnings while core statistics, requests, and sync workflows remain fully operational.

