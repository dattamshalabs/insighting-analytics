"""Send dashboard reports via email using SMTP."""

from __future__ import annotations

import json
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.orm import Dashboard, SmtpConfig

logger = logging.getLogger(__name__)


def _get_smtp_config(db: Session) -> Optional[SmtpConfig]:
    """Get the first (only) SMTP config from DB."""
    return db.query(SmtpConfig).first()


def _decrypt_password(encrypted: str) -> str:
    """Decrypt SMTP password."""
    from app.core.config import settings
    if not settings.encryption_key or not encrypted:
        return encrypted or ""
    from cryptography.fernet import Fernet
    f = Fernet(settings.encryption_key.encode())
    return f.decrypt(encrypted.encode()).decode()


def _render_dashboard_html(dashboard: Dashboard) -> str:
    """Render dashboard widgets into an HTML email body."""
    widgets = json.loads(dashboard.widgets_json) if dashboard.widgets_json else []

    html_parts = [
        "<!DOCTYPE html>",
        "<html><head><meta charset='utf-8'></head>",
        "<body style='font-family: -apple-system, BlinkMacSystemFont, sans-serif; "
        "background-color: #f8fafc; padding: 24px; color: #1e293b;'>",
        f"<div style='max-width: 700px; margin: 0 auto; background: white; "
        f"border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);'>",
        f"<h1 style='font-size: 22px; margin: 0 0 4px 0; color: #0f172a;'>{dashboard.title}</h1>",
    ]

    if dashboard.prompt:
        html_parts.append(
            f"<p style='color: #64748b; font-size: 13px; margin: 0 0 24px 0;'>{dashboard.prompt}</p>"
        )

    html_parts.append("<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;'>")

    for widget in widgets:
        w_type = widget.get("type", "")
        title = widget.get("title", "")
        data = widget.get("data")

        if w_type == "kpi":
            value = data.get("value", "-") if isinstance(data, dict) else "-"
            change = data.get("change") if isinstance(data, dict) else None
            change_html = ""
            if change is not None:
                color = "#10b981" if change >= 0 else "#ef4444"
                sign = "+" if change >= 0 else ""
                change_html = f"<span style='color: {color}; font-size: 13px;'>{sign}{change}%</span>"
            html_parts.append(
                f"<div style='display: inline-block; width: 45%; padding: 16px; margin: 8px 2%; "
                f"background: #f1f5f9; border-radius: 8px; vertical-align: top;'>"
                f"<p style='margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase;'>{title}</p>"
                f"<p style='margin: 4px 0; font-size: 28px; font-weight: 700; color: #0f172a;'>{value}</p>"
                f"{change_html}</div>"
            )

        elif w_type == "insight":
            text = data.get("text", "") if isinstance(data, dict) else str(data or "")
            # Convert markdown-style formatting to HTML
            text_html = text.replace("\n", "<br>")
            html_parts.append(
                f"<div style='padding: 16px; margin: 12px 0; background: #fefce8; "
                f"border-left: 4px solid #f59e0b; border-radius: 4px;'>"
                f"<h3 style='margin: 0 0 8px 0; font-size: 14px; color: #92400e;'>{title}</h3>"
                f"<p style='margin: 0; font-size: 13px; color: #78350f; line-height: 1.6;'>{text_html}</p>"
                f"</div>"
            )

        elif w_type == "table":
            headers = data.get("headers", []) if isinstance(data, dict) else []
            rows = data.get("rows", []) if isinstance(data, dict) else []
            html_parts.append(
                f"<div style='margin: 16px 0;'>"
                f"<h3 style='font-size: 14px; color: #334155; margin: 0 0 8px 0;'>{title}</h3>"
                f"<table style='width: 100%; border-collapse: collapse; font-size: 12px;'>"
            )
            # Header row
            html_parts.append("<thead><tr>")
            for h in headers:
                html_parts.append(
                    f"<th style='text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; "
                    f"color: #64748b; font-weight: 600;'>{h}</th>"
                )
            html_parts.append("</tr></thead><tbody>")
            # Data rows
            for row in rows[:20]:  # Limit to 20 rows in email
                html_parts.append("<tr>")
                for cell in row:
                    html_parts.append(
                        f"<td style='padding: 6px 8px; border-bottom: 1px solid #f1f5f9; "
                        f"color: #334155;'>{cell}</td>"
                    )
                html_parts.append("</tr>")
            html_parts.append("</tbody></table></div>")

        elif w_type in ("bar", "line", "area", "pie"):
            # Charts can't be rendered in email - show description
            chart_label = {"bar": "Bar Chart", "line": "Line Chart", "area": "Area Chart", "pie": "Pie Chart"}
            html_parts.append(
                f"<div style='padding: 16px; margin: 12px 0; background: #f1f5f9; "
                f"border-radius: 8px; text-align: center;'>"
                f"<p style='margin: 0; color: #64748b; font-size: 12px;'>"
                f"{chart_label.get(w_type, 'Chart')}: {title}</p>"
                f"<p style='margin: 4px 0 0 0; color: #94a3b8; font-size: 11px;'>"
                f"(View this chart in the dashboard)</p>"
                f"</div>"
            )

    html_parts.append(
        "<hr style='border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;'>"
        "<p style='color: #94a3b8; font-size: 11px; text-align: center;'>"
        "Sent from Insighting Analytics</p>"
        "</div></body></html>"
    )
    return "\n".join(html_parts)


def send_dashboard_email(
    dashboard_id: str,
    recipient_emails: List[str],
    db: Session,
    subject: Optional[str] = None,
) -> dict:
    """Send a dashboard report via email."""
    # Load SMTP config
    smtp_cfg = _get_smtp_config(db)
    if not smtp_cfg:
        return {"status": "error", "message": "SMTP not configured. Go to Admin > SMTP to set it up."}

    # Load dashboard
    dashboard = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not dashboard:
        return {"status": "error", "message": "Dashboard not found."}

    # Build email
    email_subject = subject or f"Dashboard Report: {dashboard.title}"
    html_body = _render_dashboard_html(dashboard)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = email_subject
    msg["From"] = smtp_cfg.from_email
    msg["To"] = ", ".join(recipient_emails)
    msg.attach(MIMEText(html_body, "html"))

    # Send
    try:
        password = _decrypt_password(smtp_cfg.encrypted_password) if smtp_cfg.encrypted_password else ""
        if smtp_cfg.use_tls:
            server = smtplib.SMTP(smtp_cfg.host, smtp_cfg.port, timeout=15)
            server.starttls()
        else:
            server = smtplib.SMTP(smtp_cfg.host, smtp_cfg.port, timeout=15)

        if smtp_cfg.username and password:
            server.login(smtp_cfg.username, password)

        server.sendmail(smtp_cfg.from_email, recipient_emails, msg.as_string())
        server.quit()

        logger.info("Dashboard email sent to %s", recipient_emails)
        return {"status": "ok", "message": f"Email sent to {len(recipient_emails)} recipient(s)."}

    except Exception as e:
        logger.error("Failed to send email: %s", e)
        return {"status": "error", "message": f"Failed to send email: {str(e)}"}


def test_smtp_connection(db: Session) -> dict:
    """Test SMTP connection without sending an email."""
    smtp_cfg = _get_smtp_config(db)
    if not smtp_cfg:
        return {"status": "error", "message": "SMTP not configured."}

    try:
        password = _decrypt_password(smtp_cfg.encrypted_password) if smtp_cfg.encrypted_password else ""
        if smtp_cfg.use_tls:
            server = smtplib.SMTP(smtp_cfg.host, smtp_cfg.port, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP(smtp_cfg.host, smtp_cfg.port, timeout=10)

        if smtp_cfg.username and password:
            server.login(smtp_cfg.username, password)

        server.quit()
        return {"status": "ok", "message": "SMTP connection successful."}

    except Exception as e:
        return {"status": "error", "message": f"SMTP connection failed: {str(e)}"}
