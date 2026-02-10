"""Dashboard generation service — creates structured dashboard data from natural language prompts."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Dict, List, Optional

import httpx
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.orm import Dashboard, DashboardIteration, Datasource
from app.models.schemas import DashboardIterationOut, DashboardOut, DashboardWidget
from app.services.db_engine import build_connection_string, get_default_schema

logger = logging.getLogger(__name__)


def _decrypt_password(encrypted: str) -> str:
    if not settings.encryption_key or not encrypted:
        return encrypted or ""
    from cryptography.fernet import Fernet
    f = Fernet(settings.encryption_key.encode())
    return f.decrypt(encrypted.encode()).decode()


def _load_sample_data(ds: Datasource) -> Dict[str, Any]:
    """Load sample data from a datasource for dashboard context."""
    db_type = ds.db_type or "postgresql"

    if db_type == "csv":
        if not ds.file_path:
            return {}
        try:
            df = pd.read_csv(ds.file_path, nrows=100)
            return {
                "tables": [{
                    "name": ds.name,
                    "columns": list(df.columns),
                    "dtypes": {col: str(dt) for col, dt in df.dtypes.items()},
                    "sample": df.head(5).to_dict(orient="records"),
                    "stats": df.describe(include="all").to_dict(),
                }]
            }
        except Exception as e:
            logger.warning("Failed to load CSV for dashboard: %s", e)
            return {}

    if db_type == "excel":
        if not ds.file_path:
            return {}
        try:
            xls = pd.ExcelFile(ds.file_path)
            tables = []
            for sheet in xls.sheet_names[:5]:
                df = pd.read_excel(xls, sheet_name=sheet, nrows=100)
                tables.append({
                    "name": sheet,
                    "columns": list(df.columns),
                    "dtypes": {col: str(dt) for col, dt in df.dtypes.items()},
                    "sample": df.head(5).to_dict(orient="records"),
                    "stats": df.describe(include="all").to_dict(),
                })
            return {"tables": tables}
        except Exception as e:
            logger.warning("Failed to load Excel for dashboard: %s", e)
            return {}

    # Database-backed
    pwd = _decrypt_password(ds.encrypted_password) if ds.encrypted_password else ""
    conn_str = build_connection_string(
        db_type=db_type,
        host=ds.host, port=ds.port, database=ds.database,
        username=ds.username, password=pwd, ssl_mode=ds.ssl_mode or "disable",
        http_path=ds.http_path, catalog=ds.catalog,
        access_token=_decrypt_password(ds.access_token) if ds.access_token else None,
    )
    engine = create_engine(conn_str, pool_pre_ping=True)
    schema_name = get_default_schema(db_type) or None

    tables = []
    try:
        if db_type == "postgresql":
            q = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        elif db_type == "mysql":
            q = "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'"
        elif db_type == "mssql":
            q = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'dbo' AND table_type = 'BASE TABLE'"
        else:
            q = "SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE'"

        with engine.connect() as conn:
            result = conn.execute(text(q))
            table_names = [row[0] for row in result]

        for table_name in table_names[:10]:
            try:
                df = pd.read_sql(f"SELECT * FROM {table_name} LIMIT 100", engine)
                tables.append({
                    "name": table_name,
                    "columns": list(df.columns),
                    "dtypes": {col: str(dt) for col, dt in df.dtypes.items()},
                    "row_count": len(df),
                    "stats": df.describe(include="all").fillna("").to_dict(),
                })
            except Exception:
                pass
    except Exception as e:
        logger.warning("Failed to load data for dashboard: %s", e)

    return {"tables": tables}


async def generate_dashboard(
    prompt: str,
    db: Session,
    datasource_id: Optional[str] = None,
) -> DashboardOut:
    """Generate a dashboard from a natural language prompt."""

    # Load datasource context
    data_context = ""
    ds = None
    if datasource_id:
        ds = db.query(Datasource).filter(Datasource.id == datasource_id).first()
        if ds:
            sample = _load_sample_data(ds)
            if sample.get("tables"):
                ctx_parts = []
                for t in sample["tables"]:
                    cols = ", ".join(t.get("columns", []))
                    ctx_parts.append(f"Table '{t['name']}': columns [{cols}]")
                    if t.get("stats"):
                        ctx_parts.append(f"  Stats: {json.dumps(t['stats'], default=str)[:500]}")
                data_context = "\n".join(ctx_parts)

    # Build LLM prompt for dashboard generation
    llm_prompt = f"""You are an analytics dashboard generator. Given a user's request and dataset info, generate a dashboard specification as a JSON array of widgets.

Each widget must have:
- "id": unique string
- "type": one of "kpi", "bar", "line", "area", "pie", "table", "insight"
- "title": descriptive title
- "data": the data for the widget (structure depends on type)
- "config": optional config like colors, format

For KPI widgets: data should be {{"value": <number or string>, "change": <percentage number>, "period": "vs last period"}}
For chart widgets (bar, line, area, pie): data should be an array of {{"label": <string>, "value": <number>}}
For table widgets: data should be {{"headers": [...], "rows": [[...], ...]}}
For insight widgets: data should be {{"text": <markdown string with the insight>}}

Generate 4-8 widgets that best answer the user's request.

Dataset info:
{data_context or "No specific dataset info available. Generate sample/example widgets based on the prompt."}

User request: {prompt}

Respond with ONLY a valid JSON array of widgets, nothing else."""

    # Call Ollama LLM
    widgets = []
    try:
        headers = {"Content-Type": "application/json"}
        if settings.ollama_api_token:
            headers["Authorization"] = f"Bearer {settings.ollama_api_token}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/v1/chat/completions",
                headers=headers,
                json={
                    "model": settings.ollama_model,
                    "messages": [{"role": "user", "content": llm_prompt}],
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]

            # Parse JSON from response (handle markdown code blocks)
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

            raw_widgets = json.loads(content)
            if isinstance(raw_widgets, dict) and "widgets" in raw_widgets:
                raw_widgets = raw_widgets["widgets"]

            for w in raw_widgets[:8]:
                widgets.append(DashboardWidget(
                    id=w.get("id", str(uuid.uuid4())[:8]),
                    type=w.get("type", "insight"),
                    title=w.get("title", "Untitled"),
                    data=w.get("data"),
                    config=w.get("config", {}),
                ))
    except Exception as e:
        logger.error("Dashboard generation failed: %s", e)
        # Return a fallback insight widget
        widgets = [DashboardWidget(
            id="fallback",
            type="insight",
            title="Dashboard Generation",
            data={"text": f"Unable to generate dashboard automatically. Error: {str(e)}. Please try a more specific prompt."},
        )]

    # Generate title
    title = prompt[:60] + ("..." if len(prompt) > 60 else "")

    # Save to DB
    dashboard = Dashboard(
        title=title,
        datasource_id=datasource_id,
        prompt=prompt,
        widgets_json=json.dumps([w.model_dump() for w in widgets], default=str),
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)

    return DashboardOut(
        id=dashboard.id,
        title=dashboard.title,
        datasource_id=dashboard.datasource_id,
        prompt=dashboard.prompt,
        widgets=widgets,
        created_at=dashboard.created_at,
        updated_at=dashboard.updated_at,
    )


def list_dashboards(db: Session) -> List[DashboardOut]:
    """List all saved dashboards."""
    rows = db.query(Dashboard).order_by(Dashboard.created_at.desc()).all()
    results = []
    for d in rows:
        try:
            widgets = [DashboardWidget(**w) for w in json.loads(d.widgets_json or "[]")]
        except Exception:
            widgets = []
        results.append(DashboardOut(
            id=d.id,
            title=d.title,
            datasource_id=d.datasource_id,
            prompt=d.prompt,
            widgets=widgets,
            created_at=d.created_at,
            updated_at=d.updated_at,
        ))
    return results


def get_dashboard(db: Session, dashboard_id: str) -> Optional[DashboardOut]:
    """Get a single dashboard by ID."""
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        return None
    try:
        widgets = [DashboardWidget(**w) for w in json.loads(d.widgets_json or "[]")]
    except Exception:
        widgets = []
    return DashboardOut(
        id=d.id,
        title=d.title,
        datasource_id=d.datasource_id,
        prompt=d.prompt,
        widgets=widgets,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


def delete_dashboard(db: Session, dashboard_id: str) -> bool:
    """Delete a dashboard."""
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        return False
    db.delete(d)
    db.commit()
    return True


async def iterate_dashboard(
    dashboard_id: str,
    feedback: str,
    db: Session,
) -> Optional[DashboardOut]:
    """Iterate on a dashboard based on user feedback."""
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        return None

    # Get current widgets
    try:
        current_widgets = json.loads(dashboard.widgets_json or "[]")
    except Exception:
        current_widgets = []

    # Load datasource context if available
    data_context = ""
    if dashboard.datasource_id:
        ds = db.query(Datasource).filter(Datasource.id == dashboard.datasource_id).first()
        if ds:
            sample = _load_sample_data(ds)
            if sample.get("tables"):
                ctx_parts = []
                for t in sample["tables"]:
                    cols = ", ".join(t.get("columns", []))
                    ctx_parts.append(f"Table '{t['name']}': columns [{cols}]")
                data_context = "\n".join(ctx_parts)

    # Build iteration prompt
    llm_prompt = f"""You are an analytics dashboard generator. The user has an existing dashboard and wants to improve it based on their feedback.

Current dashboard widgets:
{json.dumps(current_widgets, default=str, indent=2)}

Original prompt: {dashboard.prompt or "N/A"}

Dataset info:
{data_context or "No specific dataset info available."}

User feedback: {feedback}

Based on the feedback, generate an IMPROVED version of the dashboard. Respond with ONLY a valid JSON array of widgets.

Each widget must have:
- "id": unique string
- "type": one of "kpi", "bar", "line", "area", "pie", "table", "insight"
- "title": descriptive title
- "data": the data for the widget
- "config": optional config

You may:
- Keep existing widgets that are still relevant (keep their IDs)
- Modify widgets based on feedback
- Add new widgets
- Remove widgets that don't add value

Respond with ONLY a valid JSON array of widgets, nothing else."""

    # Call LLM
    new_widgets = []
    try:
        headers = {"Content-Type": "application/json"}
        if settings.ollama_api_token:
            headers["Authorization"] = f"Bearer {settings.ollama_api_token}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/v1/chat/completions",
                headers=headers,
                json={
                    "model": settings.ollama_model,
                    "messages": [{"role": "user", "content": llm_prompt}],
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]

            # Parse JSON from response
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                content = content.strip()

            raw_widgets = json.loads(content)
            if isinstance(raw_widgets, dict) and "widgets" in raw_widgets:
                raw_widgets = raw_widgets["widgets"]

            for w in raw_widgets[:8]:
                new_widgets.append(DashboardWidget(
                    id=w.get("id", str(uuid.uuid4())[:8]),
                    type=w.get("type", "insight"),
                    title=w.get("title", "Untitled"),
                    data=w.get("data"),
                    config=w.get("config", {}),
                ))
    except Exception as e:
        logger.error("Dashboard iteration failed: %s", e)
        return None

    # Calculate iteration number
    iteration_count = db.query(DashboardIteration).filter(
        DashboardIteration.dashboard_id == dashboard_id
    ).count()

    # Save iteration history
    iteration = DashboardIteration(
        dashboard_id=dashboard_id,
        iteration_number=iteration_count + 1,
        feedback=feedback,
        previous_widgets_json=dashboard.widgets_json,
        new_widgets_json=json.dumps([w.model_dump() for w in new_widgets], default=str),
    )
    db.add(iteration)

    # Update dashboard
    dashboard.widgets_json = json.dumps([w.model_dump() for w in new_widgets], default=str)
    db.commit()
    db.refresh(dashboard)

    return DashboardOut(
        id=dashboard.id,
        title=dashboard.title,
        datasource_id=dashboard.datasource_id,
        prompt=dashboard.prompt,
        widgets=new_widgets,
        created_at=dashboard.created_at,
        updated_at=dashboard.updated_at,
    )


def get_iterations(db: Session, dashboard_id: str) -> List[DashboardIterationOut]:
    """Get iteration history for a dashboard."""
    iterations = (
        db.query(DashboardIteration)
        .filter(DashboardIteration.dashboard_id == dashboard_id)
        .order_by(DashboardIteration.iteration_number.desc())
        .all()
    )
    return [
        DashboardIterationOut(
            id=i.id,
            dashboard_id=i.dashboard_id,
            iteration_number=i.iteration_number,
            feedback=i.feedback,
            created_at=i.created_at,
        )
        for i in iterations
    ]
