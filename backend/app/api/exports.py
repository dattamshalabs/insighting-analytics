"""GET /export/{conversation_id} (PDF/CSV)."""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import export as export_svc

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/{conversation_id}")
async def export_conversation(
    conversation_id: str,
    format: str = "csv",
    db: Session = Depends(get_db),
):
    if format == "csv":
        buf = export_svc.export_csv(db, conversation_id)
        if not buf:
            raise HTTPException(status_code=404, detail="Conversation not found or empty")
        return StreamingResponse(
            buf,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={conversation_id}.csv"},
        )
    elif format == "pdf":
        buf = export_svc.export_pdf(db, conversation_id)
        if not buf:
            raise HTTPException(status_code=404, detail="Conversation not found or empty")
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={conversation_id}.pdf"},
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'csv' or 'pdf'.")
