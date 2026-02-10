# context.md — Session Context for Insighting Analytics

This file captures the full context of all changes made to the Insighting Analytics platform. Use it to resume work without re-establishing context.

---

## What Was Done

A comprehensive UI/UX overhaul + feature expansion of the Insighting Analytics platform. The goal was to transform it from a basic prototype into a world-class, scalable product inspired by PandasAI/Annie.

---

## All Changes Made

### 1. Backend — On-Demand Recommendations

**`backend/app/services/intelligence.py`**
- Removed auto-recommendation generation from `process_query()`. Changed from calling `rec_svc.generate_recommendations()` to just initializing empty list with comment: `# 9. Recommendations — now generated on-demand via /chat/recommendations`

**`backend/app/models/schemas.py`**
- Added new Pydantic models:
  - `RecommendationRequest(message_id: str)`
  - `RecommendationResponse(recommendations: list[Recommendation])`
  - `FeedbackRequest(message_id: str, rating: Literal["up", "down"])`
  - `FeedbackResponse(status: str)`
  - `ConversationRenameRequest(name: str)`

**`backend/app/models/orm.py`**
- Added `MessageFeedback` SQLAlchemy table:
  ```python
  class MessageFeedback(Base):
      __tablename__ = "message_feedback"
      id = Column(String, primary_key=True, default=_uuid)
      message_id = Column(String, ForeignKey("messages.id"), nullable=False)
      rating = Column(String, nullable=False)  # "up" | "down"
      created_at = Column(DateTime, default=_now)
  ```

**`backend/app/services/conversation.py`**
- Added methods: `rename_conversation()`, `delete_conversation()`, `get_message()`, `update_message_recommendations()`

**`backend/app/api/chat.py`**
- Completely rewritten with new endpoints:
  - `POST /chat/recommendations` — On-demand recommendation generation (checks existing, generates if none, persists)
  - `POST /chat/feedback` — Submit thumbs up/down
  - `PATCH /chat/sessions/{session_id}` — Rename conversation
  - `DELETE /chat/sessions/{session_id}` — Delete conversation
  - Existing endpoints preserved: `POST /chat`, `GET /chat/sessions`, `GET /chat/history/{session_id}`

---

### 2. Frontend — Complete UI/UX Overhaul

**Design System:**
- `tailwind.config.ts` — Brand colors (indigo), surface grays, JetBrains Mono font, animations (typing-dot, pulse-glow, float, slide-in, scale-in, spin-slow), box shadows (glow, inner-glow, card, elevated)
- `globals.css` — CSS variables, glass-card with inner glow pseudo-element, btn-primary with gradient + glow, btn-secondary, btn-ghost, btn-danger, btn-icon, input-glass, badge variants (brand/success/warning/danger/neutral), code-block, noise texture overlay via SVG data URI, gradient body background, custom scrollbar, tooltip system

**Layout (`layout.tsx`):**
- Premium navigation sidebar with animated logo (SparklesIcon + gradient)
- Dashboards added to nav items (ChartBarSquareIcon)
- Active nav indicator bar (3px rounded indigo bar)
- Keyboard shortcuts (Cmd+N for new chat)
- ToastProvider wrapping entire app
- Collapsible sidebar with smooth transitions

**Chat Page (`page.tsx`):**
- TypingIndicator with 3 animated dots + "Analyzing your data..."
- EmptyState with animated floating SparklesIcon orb, 4 suggested prompts with icons/colors
- Chat history sidebar with search, date-grouped sessions
- Smart auto-scroll with scroll-to-bottom button (AnimatePresence)
- Multi-line textarea with auto-resize (max 160px)
- Error state with retry button
- Brand-colored send button with glow shadow

**MessageBubble.tsx:**
- AI avatar with gradient brand/purple ring + SparklesIcon
- User avatar with UserIcon in surface-300 background
- User messages: right-aligned, rounded-tr-md, brand-600 bg
- Assistant messages: left-aligned with glass-card
- Action bar: copy (with checkmark feedback), thumbs up/down (active state), timestamp
- Improved DataTable with uppercase tracking-wider headers

**RecommendationCard.tsx (key feature change):**
- Now lazy-loaded with prompt button — shows "Get AI Recommendations" button when no recommendations exist
- Loading state with spinning border animation
- When recommendations exist (from history), shows them directly
- Individual items: expandable, priority badges (high/medium/low), rationale on expand, confidence progress bar
- Props: `{ message: Message; onFetchRecommendations: (messageId: string) => Promise<Recommendation[]> }`

**ThoughtProcess.tsx:**
- Copy-to-clipboard for SQL and code (CheckIcon feedback)
- AnimatePresence for expand/collapse
- CodeBracketIcon toggle, `.code-block` class

**DataQualityBanner.tsx:**
- Expandable banner with score progress bar (emerald/amber/red)
- Severity icons (XCircle/ExclamationTriangle/Information)
- Issue list with column name highlighting

**ChatHistory.tsx:**
- Date grouping: Today, Yesterday, This Week, Older
- Inline rename (Enter/Escape), delete with confirmation
- Active indicator bar, time formatting

**Toast.tsx (new):**
- ToastProvider context with `useToast()` hook
- 4 types: success (emerald), error (red), warning (amber), info (brand)
- Auto-dismiss 4s, slide-in/out animations, fixed bottom-right

**Other UI components updated:**
- `Modal.tsx` — added `description` + `size` props
- `EmptyState.tsx` — icon container + fade-in animation
- `StatCard.tsx` — optional `trend` prop
- `ToggleSwitch.tsx` — brand-500 color
- `Skeleton.tsx` — shimmer color update
- `ExportMenu.tsx` — dropdown with icons + scale-in animation
- `ChartPanel.tsx` — donut chart, area chart with gradient fill
- `ChartTypeSelector.tsx` — segmented control style
- `chartUtils.ts` — updated CHART_COLORS with brand indigo first
- `SchemaViewer.tsx` — collapsible tables, PK/FK badges
- `SignificanceBadge.tsx` — dot indicator badge
- `TimeSeriesChart.tsx` — updated to match new design

---

### 3. Frontend — New Pages

**Login (`login/page.tsx`):**
- Animated gradient orbs with staggered delays
- SparklesIcon logo in gradient container with glow shadow
- Form labels above inputs, loading spinner
- "Powered by Ollama" footer

**Datasources (`datasources/page.tsx`):**
- 6 database type selector cards: PostgreSQL, MySQL, SQL Server, Databricks, CSV, Excel
- File upload UI for CSV/Excel (drag-to-upload area, file size display)
- Databricks-specific fields (HTTP Path, Catalog, Access Token)
- Toast notifications, refresh button, motion stagger animations

**Dashboards (`dashboards/page.tsx`) — NEW:**
- AI dashboard generation with prompt input
- Quick templates: "Sales overview with KPIs and trends", "Customer segmentation analysis", etc.
- Datasource selector dropdown
- DashboardWidget types: kpi, bar, line, area, pie, table, insight
- KPICard, ChartWidget, InsightCard components
- DashboardGrid with responsive 4-column layout
- GenerateDashboard modal with textarea + templates

**Glossary (`glossary/page.tsx`):**
- Search with icon prefix, form labels, toast notifications, motion stagger

**Alerts (`alerts/page.tsx`):**
- Copy SQL with feedback, badge-styled cron/condition, toast notifications

**Admin (`admin/page.tsx`):**
- Updated charts/tables to new design, toast on cache clear, refresh button

---

### 4. Frontend — Hooks & API

**`lib/api.ts`:**
- Added: `getRecommendations()`, `submitFeedback()`, `renameSession()`, `deleteSession()`
- Updated chart colors

**`hooks/useAnalyticsChat.ts`:**
- Added: `fetchRecommendations()`, `submitFeedback()`, `deleteSession()`, `renameSession()`
- Session limit increased from 10 to 30

**`types/index.ts`:**
- Added `DatabaseType = "postgresql" | "mysql" | "mssql" | "databricks" | "csv" | "excel"`
- Added `feedback?: "up" | "down" | null` to Message
- Added `db_type`, `http_path?`, `catalog?` to Datasource
- Added `http_path?`, `catalog?`, `access_token?` to DatasourceCreate

---

### 5. Infrastructure

**`start.sh`:**
- Stops existing instances via .pids file + port checking
- Creates venv, installs deps if needed
- Starts backend (uvicorn) + frontend (npm run dev) as nohup background processes
- Saves PIDs to `.pids`, displays service URLs

**`stop.sh`:**
- Reads `.pids` file, kills tracked processes
- Port 8000/3000 safety net check
- Reports stop status

**`claude.md`:**
- Comprehensive documentation of all features, endpoints, architecture, design system

**`SETUP.md`:**
- Updated with quick start using start.sh/stop.sh
- Added multi-database connector documentation
- Added features overview section
- Updated troubleshooting

---

### 6. v0.5.0 — Security, Authentication, View SQL, Dynamic Dashboard Prompts, Query Logging

**Security Hardening:**
- JWT authentication with access tokens (30 min) + refresh tokens (7 days)
- bcrypt password hashing for user accounts
- Rate limiting (100 requests/minute) via slowapi
- File upload validation (magic number detection, 50MB limit)
- Input validation with Pydantic field constraints
- Restricted CORS headers

**Authentication System:**
- `User` and `RefreshToken` ORM models added
- Auth service with JWT token generation and verification
- Protected endpoints require `Authorization: Bearer <token>` header
- Demo credentials: `demo@insighting.ai` / `demo2024!`, `admin@insighting.ai` / `admin2024!`

**View SQL Query Feature:**
- Added `_extract_sql_from_code()` function to parse SQL from PandasAI generated Python code
- Prominent "View SQL Query" button styled to match recommendations button (cyan theme)
- Supports: `pd.read_sql()`, `pd.read_sql_query()`, variable assignments, f-strings

**Dynamic Dashboard Prompts:**
- Added `/dashboards/suggested-prompts` endpoint
- LLM generates 4 dashboard prompts based on selected datasource schema
- Cached for 30 minutes, falls back to generic prompts

**Query Logging Fix:**
- Fixed timing bug in query logging (elapsed_ms captured after with block)
- Now logs generated code when SQL extraction fails
- Admin panel shows executed queries with duration and row counts

**Chart Timestamp Fix:**
- Records `query_start_time` before PandasAI execution
- Only returns charts with mtime >= query_start_time
- Prevents stale charts from previous queries

---

### 7. v0.4.0 — HR Dataset, Dynamic Questions, Email, Dashboard Tabs, Markdown Insights

**`scripts/seed_hr_data.sql`** (NEW)
- 7-table HR/People Analytics dataset: employees (500), employee_attrition (150), performance_ratings (1000), employee_recognition (300), pulse_surveys (2000), employee_learning (400), employee_promotions (100)
- Realistic correlations: attrition employees have lower survey scores, high performers get more recognition/promotions
- Departments: Engineering, Product, Sales, Marketing, HR, Finance, Support, Operations
- Locations: Mumbai, Bangalore, Delhi, Hyderabad, Pune, Chennai

**`backend/app/services/question_generator.py`** (NEW)
- `generate_questions(table_names, schema_summary)` — calls Ollama LLM to generate 6 analytical questions from the database schema
- In-memory cache keyed by MD5 hash of sorted table names (30-min TTL)
- Falls back to generic questions if LLM is unavailable
- Returns structured `SuggestedQuestion` objects (text, category, icon_hint)

**`backend/app/services/email_service.py`** (NEW)
- `send_dashboard_email(dashboard_id, recipient_emails, db)` — renders dashboard widgets into HTML email
- `test_smtp_connection(db)` — tests SMTP connection without sending
- Renders KPIs as styled divs, tables as HTML tables, insights as formatted text, charts as descriptions
- Loads SMTP config from `smtp_config` DB table, decrypts password with Fernet

**`backend/app/api/schema.py`** (MODIFIED)
- Added `GET /schema/suggested-questions?datasource_id={optional}` endpoint (before `/{datasource_id}` route to avoid path conflicts)
- Falls back to introspecting default PG connection if no datasource_id

**`backend/app/api/dashboards.py`** (MODIFIED)
- Added `POST /dashboards/email` endpoint for sending dashboard reports via email

**`backend/app/api/admin.py`** (MODIFIED)
- Added `GET /admin/smtp` — retrieve SMTP config
- Added `POST /admin/smtp` — save/update SMTP config (encrypts password)
- Added `POST /admin/smtp/test` — test SMTP connection

**`backend/app/models/schemas.py`** (MODIFIED)
- Added: `SuggestedQuestion`, `SuggestedQuestionsResponse`, `SmtpConfigCreate`, `SmtpConfigOut`, `DashboardEmailRequest`

**`backend/app/models/orm.py`** (MODIFIED)
- Added `SmtpConfig` table: id, host, port, username, encrypted_password, from_email, use_tls, updated_at

**`backend/app/core/config.py`** (MODIFIED)
- Added optional SMTP settings: smtp_host, smtp_port, smtp_username, smtp_password, smtp_from_email, smtp_use_tls

**`backend/app/services/intelligence.py`** (MODIFIED)
- Added `custom_whitelisted_dependencies: ["seaborn", "scipy", "numpy"]` to SmartDatalake config
- Fixes PandasAI blocking seaborn imports for correlation/scatter plot generation

**`frontend/src/app/page.tsx`** (MODIFIED)
- Replaced hardcoded `SUGGESTED_PROMPTS` with dynamic API-fetched questions via `api.getSuggestedQuestions()`
- Added `ICON_MAP` (chart/table/search/bolt → Heroicons) and `COLOR_MAP` (category → gradient)
- Added `PromptSkeleton` loading component, `EmptyState` component with API call + fallback
- Grid changed to `lg:grid-cols-3` for up to 6 dynamic questions

**`frontend/src/app/dashboards/page.tsx`** (MODIFIED)
- Added `renderMarkdown()` function: handles `## headings`, `**bold**`, `*italic*`, `- bullets`, `1. numbered lists`
- `InsightCard` now renders formatted markdown instead of raw text
- Added `EmailModal` component with recipient input and send functionality
- Replaced vertical dashboard list with horizontal tab bar + animated underline (Framer Motion)
- Email button (EnvelopeIcon) on each dashboard header

**`frontend/src/app/admin/page.tsx`** (MODIFIED)
- Added `SmtpConfigSection` component: form for host, port, username, password, from_email, use_tls
- Added "Test Connection" and "Save" buttons with loading states
- Added "smtp" tab to the existing admin tabs

**`frontend/src/lib/api.ts`** (MODIFIED)
- Added: `getSuggestedQuestions(datasourceId?)`, `sendDashboardEmail(dashboardId, recipients, subject?)`, `getSmtpConfig()`, `saveSmtpConfig(data)`, `testSmtpConnection()`

**`frontend/src/types/index.ts`** (MODIFIED)
- Added: `SuggestedQuestion`, `SuggestedQuestionsResponse`, `SmtpConfig`, `SmtpConfigCreate` interfaces

---

## Pending / Future Work

These items would be needed for full production readiness:

### Production auth
- Currently hardcoded `admin` / `admin123` in `AuthContext.tsx`
- Needs proper auth: JWT tokens, password hashing, user management API

### Other production items
- Rate limiting on API endpoints
- Proper error tracking (Sentry or similar)
- Docker Compose for containerized deployment
- CI/CD pipeline
- Comprehensive test suite (pytest + Jest/Vitest)
- HTTPS/TLS configuration
- Environment-based configuration (dev/staging/prod)

---

## Architecture Summary

```
User → Next.js (port 3000) → FastAPI (port 8000) → PandasAI → Database
                                     ↓
                              Ollama Cloud LLM
                                     ↓
                              SQLite (metadata)
```

- **Query flow:** User types question → frontend sends to `POST /chat` → `intelligence.py` orchestrates: schema introspection → prompt construction with guardrails → PandasAI SmartDatalake execution → result formatting → response with charts/stats/data quality
- **Recommendations:** NOT auto-generated. User clicks "Get AI Recommendations" → frontend calls `POST /chat/recommendations` → generates via separate LLM call → cached on the message
- **Feedback:** Thumbs up/down stored in `MessageFeedback` table via `POST /chat/feedback`
- **Dashboards:** User provides a prompt + selects datasource → frontend calls `POST /dashboards/generate` → backend loads sample data from datasource, sends structured prompt to LLM → returns array of widgets (KPI, bar, line, area, pie, table, insight) → saved to Dashboard table → frontend renders grid

---

## File Map (key files only)

```
/Volumes/T9 1/Products/insighting-analytics/
├── start.sh                          # Start all services
├── stop.sh                           # Stop all services
├── claude.md                         # Claude Code context
├── SETUP.md                          # Setup documentation
├── context.md                        # This file
│
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── api/
│   │   │   ├── chat.py               # Chat endpoints (query, recommendations, feedback, sessions)
│   │   │   ├── datasources.py        # Multi-DB datasource CRUD + file upload
│   │   │   ├── dashboards.py         # Dashboard generation & management (NEW)
│   │   │   ├── schema.py             # Schema introspection
│   │   │   ├── alerts.py             # Scheduled alerts
│   │   │   ├── glossary.py           # Business glossary
│   │   │   ├── admin.py              # Admin logs & cache
│   │   │   └── export.py             # Export conversations
│   │   ├── core/
│   │   │   ├── config.py             # Settings (pydantic-settings)
│   │   │   ├── database.py           # DB session management
│   │   │   ├── guardrails.py         # SQL/query safety
│   │   │   └── lifespan.py           # App startup/shutdown
│   │   ├── models/
│   │   │   ├── schemas.py            # 40+ Pydantic models (incl. Dashboard, DashboardWidget)
│   │   │   └── orm.py                # 10 SQLAlchemy tables (incl. Dashboard)
│   │   ├── services/
│   │   │   ├── intelligence.py       # Main query orchestrator (multi-DB aware)
│   │   │   ├── db_engine.py          # Database engine factory (NEW) — builds conn strings for all DB types
│   │   │   ├── dashboard.py          # Dashboard generation service (NEW)
│   │   │   ├── conversation.py       # Conversation/message CRUD
│   │   │   ├── recommendation.py     # Recommendation generation
│   │   │   ├── schema_registry.py    # Schema introspection (multi-DB aware)
│   │   │   ├── cache.py              # Query caching
│   │   │   ├── scheduler.py          # Alert scheduling
│   │   │   └── export.py             # Export service
│   │   ├── skills/                   # PandasAI @skill functions
│   │   └── static/charts/            # Generated chart PNGs
│   └── .env                          # Backend config
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx            # Root layout with nav sidebar
    │   │   ├── page.tsx              # Chat page (main)
    │   │   ├── globals.css           # Design system CSS
    │   │   ├── login/page.tsx        # Login page
    │   │   ├── datasources/page.tsx  # Multi-DB datasource management
    │   │   ├── dashboards/page.tsx   # AI dashboard generation (NEW)
    │   │   ├── glossary/page.tsx     # Business glossary
    │   │   ├── alerts/page.tsx       # Scheduled alerts
    │   │   └── admin/page.tsx        # Admin logs & cache
    │   ├── components/
    │   │   ├── chat/
    │   │   │   ├── MessageBubble.tsx      # Message display with actions
    │   │   │   ├── RecommendationCard.tsx # Lazy-loaded recommendations
    │   │   │   ├── ThoughtProcess.tsx     # SQL/code viewer
    │   │   │   └── DataQualityBanner.tsx  # Data quality scoring
    │   │   ├── ui/
    │   │   │   ├── ChatHistory.tsx        # Session list with search/rename/delete
    │   │   │   ├── Toast.tsx              # Toast notification system
    │   │   │   ├── Modal.tsx              # Reusable modal
    │   │   │   ├── EmptyState.tsx         # Empty state display
    │   │   │   ├── StatCard.tsx           # Stat card with trend
    │   │   │   ├── ToggleSwitch.tsx       # Toggle switch
    │   │   │   └── Skeleton.tsx           # Loading skeleton
    │   │   ├── charts/
    │   │   │   ├── ChartPanel.tsx         # Multi-type chart renderer
    │   │   │   └── ChartTypeSelector.tsx  # Chart type picker
    │   │   ├── stats/
    │   │   │   ├── SignificanceBadge.tsx   # P-value badge
    │   │   │   └── TimeSeriesChart.tsx     # Time series line chart
    │   │   ├── schema/SchemaViewer.tsx     # Schema explorer
    │   │   └── export/ExportMenu.tsx      # CSV/PDF export
    │   ├── hooks/
    │   │   ├── useAnalyticsChat.ts        # Main chat hook
    │   │   ├── useDatasources.ts          # Datasource hook
    │   │   └── useSchemaMap.ts            # Schema hook
    │   ├── lib/
    │   │   ├── api.ts                     # Typed API client
    │   │   └── chartUtils.ts              # Chart colors/helpers
    │   ├── types/index.ts                 # All TypeScript interfaces
    │   └── contexts/AuthContext.tsx        # Auth context (hardcoded)
    ├── tailwind.config.ts                 # Tailwind configuration
    └── .env.local                         # Frontend config
```

---

## Design System Reference

- **Font:** Inter (UI) + JetBrains Mono (code)
- **Brand color:** indigo-500 `#6366f1`
- **Surface grays:** `#09090b` (darkest) → `#18181b` → `#27272a` → `#3f3f46` → `#52525b` → `#71717a`
- **Glass card:** `bg-surface-200/50`, `border border-white/[0.06]`, `backdrop-blur-sm`, inner glow pseudo-element
- **Buttons:** `.btn-primary` (gradient + glow), `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-icon`
- **Inputs:** `.input-glass` with focus ring and hover state
- **Badges:** `.badge-brand`, `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-neutral`
- **Animations:** fade-in-up, typing-dot, float, shimmer, pulse-glow, scale-in, slide-in
- **Patterns:** Noise texture overlay (SVG data URI), gradient orbs, inner glow borders
