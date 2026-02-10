"""Seed initial demo users for UAT and development."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.orm import User
from app.services.auth import hash_password

logger = logging.getLogger(__name__)

# Demo credentials for UAT
DEMO_USERS = [
    {
        "email": "demo@insighting.ai",
        "password": "demo2024!",
        "role": "user",
    },
    {
        "email": "admin@insighting.ai",
        "password": "admin2024!",
        "role": "admin",
    },
]


def seed_demo_users(db: Session) -> None:
    """Create demo users if they don't exist."""
    for user_data in DEMO_USERS:
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if not existing:
            user = User(
                email=user_data["email"],
                password_hash=hash_password(user_data["password"]),
                role=user_data["role"],
                is_active=True,
            )
            db.add(user)
            logger.info("Created demo user: %s (%s)", user_data["email"], user_data["role"])

    db.commit()
    logger.info("Demo users seeded successfully")
