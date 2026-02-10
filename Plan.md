# Insighting Analytics Platform Improvements Plan

## Context

The Insighting Analytics platform requires security hardening, user management, testing infrastructure, and new features. Critical security vulnerabilities were identified including `eval()` code injection, SQL injection, and missing authentication. New features requested: dashboard iteration, alert connectors (email/Slack/SFTP), and glossary SQL formulae.

---

## Phase 1: Critical Security Fixes (Priority: CRITICAL)

### 1.1 Replace eval() with Safe Expression Parser
**File:** `/backend/app/services/scheduler.py` (lines 119-124)

- Add `simpleeval>=0.9` to dependencies
- Replace `_eval_condition()` with safe parser that only allows: `>`, `<`, `>=`, `<=`, `==`, `!=`, `and`, `or`, `not`
- Only expose `result` variable

### 1.2 Fix SQL Injection in Row Count Queries
**File:** `/backend/app/services/db_engine.py` (lines 102-116)

- Add `_quote_identifier()` helper to sanitize table names
- Use parameterized queries with `text()` bindings

### 1.3 Add Rate Limiting
**Files:**
- `/backend/app/main.py` - Add slowapi middleware
- `/backend/app/core/rate_limit.py` (NEW) - Limiter config

```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
```

### 1.4 Fix File Upload Validation
**File:** `/backend/app/api/datasources.py` (lines 114-149)

- Add `python-magic>=0.4` for content-type detection
- Max file size: 50MB
- Sanitize filenames with `_sanitize_filename()`

### 1.5 Add Input Validation
**File:** `/backend/app/models/schemas.py`

- Add `Field(max_length=...)` constraints
- Add `@field_validator` for cron expressions and threshold conditions
- Add `EmailStr` for email fields

### 1.6 Restrict CORS
**File:** `/backend/app/main.py`

- Limit `allow_methods` to `["GET", "POST", "PUT", "PATCH", "DELETE"]`
- Limit `allow_headers` to `["Content-Type", "Authorization"]`

---

## Phase 2: Authentication & User Management

### 2.1 New ORM Models
**File:** `/backend/app/models/orm.py`

```python
class User(Base):
    id, email, password_hash, role, is_active, created_at, updated_at, last_login_at

class RefreshToken(Base):
    id, user_id, token_hash, expires_at, revoked, created_at
```

### 2.2 Auth Schemas
**File:** `/backend/app/models/schemas.py`

- `UserCreate`, `UserOut`, `LoginRequest`, `TokenResponse`, `RefreshRequest`

### 2.3 Auth Service
**File:** `/backend/app/services/auth.py` (NEW)

- `hash_password()`, `verify_password()` using bcrypt
- `create_access_token()`, `create_refresh_token()` using JWT
- `verify_access_token()`, `verify_refresh_token()`

### 2.4 Auth Middleware
**File:** `/backend/app/core/auth.py` (NEW)

- `get_current_user()` - Extract user from JWT
- `require_admin()` - Role check dependency

### 2.5 Auth API Router
**File:** `/backend/app/api/auth.py` (NEW)

- `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`

### 2.6 Protect Existing Endpoints
**Files:** All routers in `/backend/app/api/`

- Add `current_user: User = Depends(get_current_user)` to each endpoint
- Add `Depends(require_admin)` to admin endpoints

### 2.7 Frontend Auth
**Files:**
- `/frontend/src/contexts/AuthContext.tsx` - JWT token management
- `/frontend/src/lib/api.ts` - Add Authorization header, token refresh on 401

---

## Phase 3: Testing Infrastructure

### 3.1 Backend Tests
**Files:**
- `/backend/tests/conftest.py` (NEW) - Fixtures with in-memory SQLite
- `/backend/tests/test_auth.py` (NEW)
- `/backend/tests/test_glossary.py` (NEW)
- `/backend/tests/test_alerts.py` (NEW)
- `/backend/tests/test_dashboards.py` (NEW)

### 3.2 Frontend Tests
**Files:**
- `/frontend/vitest.config.ts` (NEW)
- `/frontend/src/test/setup.ts` (NEW)
- `/frontend/src/components/**/*.test.tsx` (NEW)

**Dependencies:** `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`

---

## Phase 4: Dashboard Iteration Feature

### 4.1 ORM Model
**File:** `/backend/app/models/orm.py`

```python
class DashboardIteration(Base):
    id, dashboard_id, iteration_number, feedback, previous_widgets_json, new_widgets_json, created_at
```

### 4.2 Schema
**File:** `/backend/app/models/schemas.py`

- `DashboardIterateRequest(feedback: str)`
- `DashboardIterationOut`

### 4.3 Service
**File:** `/backend/app/services/dashboard.py`

- `iterate_dashboard(dashboard_id, feedback, db)` - Load current widgets, build iteration prompt, call LLM, save history, update dashboard

### 4.4 API
**File:** `/backend/app/api/dashboards.py`

- `PATCH /dashboards/{id}/iterate` - Iterate dashboard
- `GET /dashboards/{id}/iterations` - Get iteration history

### 4.5 Frontend
**File:** `/frontend/src/app/dashboards/page.tsx`

- Add "Iterate" button with SparklesIcon
- Add IterateModal with feedback textarea
- Call `api.iterateDashboard()`

---

## Phase 5: Alert Connectors (Email, Slack, SFTP)

### 5.1 Connector Interface
**File:** `/backend/app/services/alert_connectors.py` (NEW)

```python
class AlertConnector(ABC):
    async def send(alert_name, value, condition, config) -> bool
    @classmethod
    def validate_config(config) -> bool

class EmailConnector(AlertConnector): ...  # Reuse SMTP config
class SlackConnector(AlertConnector): ...  # Webhook POST
class SFTPConnector(AlertConnector): ...   # paramiko upload
```

### 5.2 ORM Model
**File:** `/backend/app/models/orm.py`

```python
class AlertConnector(Base):
    id, alert_id, connector_type, config_json (encrypted), enabled, created_at
```

### 5.3 Scheduler Update
**File:** `/backend/app/services/scheduler.py`

- In `_execute_alert()`: loop through `alert.connectors`, dispatch to each enabled connector

### 5.4 API
**File:** `/backend/app/api/alerts.py`

- `POST /alerts/{id}/connectors` - Add connector
- `GET /alerts/{id}/connectors` - List connectors
- `DELETE /alerts/{id}/connectors/{connector_id}` - Remove connector

### 5.5 Frontend
**File:** `/frontend/src/app/alerts/page.tsx`

- Add connector type selector (dropdown)
- Conditional config fields per connector type
- Display configured connectors per alert

---

## Phase 6: Glossary SQL Formulae

### 6.1 Enhanced ORM
**File:** `/backend/app/models/orm.py`

Add to `GlossaryTerm`:
- `formula_type` (expression | calculation | metric)
- `result_type` (numeric | string | boolean)
- `dependencies_json` (array of dependent term names)

### 6.2 SQL Validation
**File:** `/backend/app/services/sql_validator.py` (NEW)

- `validate_sql_expression(sql)` - Block DROP/DELETE/INSERT/UPDATE, comments, multiple statements
- `extract_dependencies(sql, existing_terms)` - Find references to other terms

### 6.3 Enhanced Prompt Injection
**File:** `/backend/app/services/intelligence.py`

- Update `_build_system_prompt()` to include formula types, result types, and clear usage instructions

### 6.4 Frontend
**File:** `/frontend/src/app/glossary/page.tsx`

- Add formula_type and result_type dropdowns
- Add basic SQL syntax highlighting
- Show dependency graph

---

## New Dependencies

### Backend (`pyproject.toml`)
```toml
"simpleeval>=0.9"
"slowapi>=0.1"
"python-magic>=0.4"
"passlib[bcrypt]>=1.7"
"python-jose[cryptography]>=3.3"
"paramiko>=3.4"
"sqlparse>=0.5"
```

### Frontend (`package.json`)
```json
"vitest": "^1.4"
"@testing-library/react": "^14.2"
"@testing-library/jest-dom": "^6.4"
"jsdom": "^24.0"
```

---

## Implementation Order

```
Phase 1 (Security) ──► Phase 2 (Auth) ──► Phase 3 (Testing) ──┬──► Phase 4 (Dashboard Iteration)
                                                               ├──► Phase 5 (Alert Connectors)
                                                               └──► Phase 6 (Glossary SQL)
```

Phases 4, 5, 6 can run in parallel after Phase 3.

---

## Verification

### After Phase 1
```bash
# Test rate limiting
for i in {1..150}; do curl http://localhost:8000/health; done
# Should get 429 after 100 requests

# Test file upload validation
curl -X POST http://localhost:8000/datasources/upload -F "file=@/etc/passwd"
# Should get 400 error
```

### After Phase 2
```bash
# Test auth flow
curl -X POST http://localhost:8000/auth/register -d '{"email":"test@test.com","password":"password123"}'
curl -X POST http://localhost:8000/auth/login -d '{"email":"test@test.com","password":"password123"}'
# Should get tokens

# Test protected endpoint without auth
curl http://localhost:8000/datasources
# Should get 401
```

### After Phase 3
```bash
# Backend tests
cd backend && source .venv/bin/activate && pytest -v

# Frontend tests
cd frontend && npm test
```

### After Phase 4
- Generate a dashboard, click "Iterate", enter feedback, verify widgets update

### After Phase 5
- Create alert with Slack connector, trigger alert, verify Slack message

### After Phase 6
- Create glossary term with SQL formula, ask question using term, verify SQL substitution

---

## Files Summary

**New Files (13):**
- `/backend/app/api/auth.py`
- `/backend/app/services/auth.py`
- `/backend/app/services/alert_connectors.py`
- `/backend/app/services/sql_validator.py`
- `/backend/app/core/auth.py`
- `/backend/app/core/rate_limit.py`
- `/backend/tests/conftest.py`
- `/backend/tests/test_auth.py`
- `/backend/tests/test_glossary.py`
- `/backend/tests/test_alerts.py`
- `/backend/tests/test_dashboards.py`
- `/frontend/vitest.config.ts`
- `/frontend/src/test/setup.ts`

**Modified Files (15):**
- `/backend/app/main.py`
- `/backend/app/models/orm.py`
- `/backend/app/models/schemas.py`
- `/backend/app/services/scheduler.py`
- `/backend/app/services/db_engine.py`
- `/backend/app/services/dashboard.py`
- `/backend/app/services/intelligence.py`
- `/backend/app/api/chat.py`
- `/backend/app/api/datasources.py`
- `/backend/app/api/dashboards.py`
- `/backend/app/api/alerts.py`
- `/backend/app/api/glossary.py`
- `/backend/app/api/admin.py`
- `/frontend/src/contexts/AuthContext.tsx`
- `/frontend/src/lib/api.ts`
- `/frontend/src/app/dashboards/page.tsx`
- `/frontend/src/app/alerts/page.tsx`
- `/frontend/src/app/glossary/page.tsx`
