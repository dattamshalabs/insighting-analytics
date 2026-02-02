"""PDF and CSV export generation for conversations."""

from __future__ import annotations

import csv
import io
import json
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from app.models.orm import Conversation, Message
from app.services.conversation import get_conversation_with_messages

logger = logging.getLogger(__name__)


def export_csv(db: Session, conversation_id: str) -> Optional[io.StringIO]:
    """Export the last query result from a conversation as CSV."""
    conv = get_conversation_with_messages(db, conversation_id)
    if not conv or not conv.messages:
        return None

    # Find last assistant message with content
    last_msg = None
    for msg in reversed(conv.messages):
        if msg.role == "assistant":
            last_msg = msg
            break

    if not last_msg:
        return None

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Role", "Content", "SQL", "Recommendations"])

    for msg in conv.messages:
        recs = ""
        if msg.recommendations_json:
            try:
                recs = json.dumps(json.loads(msg.recommendations_json), indent=2)
            except Exception:
                recs = msg.recommendations_json or ""
        writer.writerow([
            msg.role,
            msg.content,
            msg.generated_sql or "",
            recs,
        ])

    buf.seek(0)
    return buf


def export_pdf(db: Session, conversation_id: str) -> Optional[io.BytesIO]:
    """Export conversation as PDF using reportlab."""
    conv = get_conversation_with_messages(db, conversation_id)
    if not conv or not conv.messages:
        return None

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError:
        logger.error("reportlab not installed — PDF export unavailable")
        return None

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"Conversation: {conv.title}", styles["Title"]))
    story.append(Spacer(1, 12))

    for msg in conv.messages:
        role_label = "You" if msg.role == "user" else "Assistant"
        story.append(Paragraph(f"<b>{role_label}:</b>", styles["Heading3"]))
        # Sanitize content for reportlab XML parser
        safe_content = (msg.content or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        story.append(Paragraph(safe_content, styles["BodyText"]))

        if msg.generated_sql:
            safe_sql = msg.generated_sql.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            story.append(Paragraph(f"<i>SQL: {safe_sql}</i>", styles["Code"]))

        story.append(Spacer(1, 8))

    doc.build(story)
    buf.seek(0)
    return buf
