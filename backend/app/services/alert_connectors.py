"""Alert connectors - Email, Slack, SFTP for alert notifications."""

from __future__ import annotations

import json
import logging
import smtplib
from abc import ABC, abstractmethod
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


class AlertConnectorBase(ABC):
    """Base class for alert connectors."""

    connector_type: str = "base"

    @abstractmethod
    async def send(
        self,
        alert_name: str,
        value: Any,
        condition: str,
        config: Dict[str, Any],
    ) -> bool:
        """Send an alert notification. Returns True on success."""
        pass

    @classmethod
    @abstractmethod
    def validate_config(cls, config: Dict[str, Any]) -> bool:
        """Validate the connector configuration."""
        pass

    @classmethod
    def get_required_fields(cls) -> list[str]:
        """Return list of required config fields."""
        return []


class EmailConnector(AlertConnectorBase):
    """Send alert notifications via email using SMTP."""

    connector_type = "email"

    @classmethod
    def get_required_fields(cls) -> list[str]:
        return ["recipients", "smtp_host", "smtp_port", "from_email"]

    @classmethod
    def validate_config(cls, config: Dict[str, Any]) -> bool:
        required = cls.get_required_fields()
        return all(config.get(field) for field in required)

    async def send(
        self,
        alert_name: str,
        value: Any,
        condition: str,
        config: Dict[str, Any],
    ) -> bool:
        try:
            recipients = config.get("recipients", [])
            if isinstance(recipients, str):
                recipients = [r.strip() for r in recipients.split(",")]

            smtp_host = config.get("smtp_host")
            smtp_port = int(config.get("smtp_port", 587))
            from_email = config.get("from_email")
            username = config.get("smtp_username")
            password = config.get("smtp_password")
            use_tls = config.get("use_tls", True)

            # Build email
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"Alert Triggered: {alert_name}"
            msg["From"] = from_email
            msg["To"] = ", ".join(recipients)

            html_body = f"""
            <html>
            <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #dc2626;">Alert: {alert_name}</h2>
                <p><strong>Condition:</strong> {condition}</p>
                <p><strong>Current Value:</strong> {value}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">
                    This is an automated alert from Insighting Analytics.
                </p>
            </body>
            </html>
            """
            msg.attach(MIMEText(html_body, "html"))

            # Send email
            if use_tls:
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls()
                    if username and password:
                        server.login(username, password)
                    server.sendmail(from_email, recipients, msg.as_string())
            else:
                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    if username and password:
                        server.login(username, password)
                    server.sendmail(from_email, recipients, msg.as_string())

            logger.info("Email alert sent for '%s' to %s", alert_name, recipients)
            return True

        except Exception as e:
            logger.error("Email alert failed for '%s': %s", alert_name, e)
            return False


class SlackConnector(AlertConnectorBase):
    """Send alert notifications to Slack via webhook."""

    connector_type = "slack"

    @classmethod
    def get_required_fields(cls) -> list[str]:
        return ["webhook_url"]

    @classmethod
    def validate_config(cls, config: Dict[str, Any]) -> bool:
        webhook_url = config.get("webhook_url", "")
        return webhook_url.startswith("https://hooks.slack.com/")

    async def send(
        self,
        alert_name: str,
        value: Any,
        condition: str,
        config: Dict[str, Any],
    ) -> bool:
        try:
            webhook_url = config.get("webhook_url")
            channel = config.get("channel")  # Optional override

            payload = {
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": f"Alert: {alert_name}",
                            "emoji": True,
                        },
                    },
                    {
                        "type": "section",
                        "fields": [
                            {"type": "mrkdwn", "text": f"*Condition:*\n{condition}"},
                            {"type": "mrkdwn", "text": f"*Current Value:*\n{value}"},
                        ],
                    },
                    {
                        "type": "context",
                        "elements": [
                            {
                                "type": "mrkdwn",
                                "text": "Sent from Insighting Analytics",
                            }
                        ],
                    },
                ],
            }

            if channel:
                payload["channel"] = channel

            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(webhook_url, json=payload)
                resp.raise_for_status()

            logger.info("Slack alert sent for '%s'", alert_name)
            return True

        except Exception as e:
            logger.error("Slack alert failed for '%s': %s", alert_name, e)
            return False


class SFTPConnector(AlertConnectorBase):
    """Upload alert data to SFTP server."""

    connector_type = "sftp"

    @classmethod
    def get_required_fields(cls) -> list[str]:
        return ["host", "username", "remote_path"]

    @classmethod
    def validate_config(cls, config: Dict[str, Any]) -> bool:
        required = cls.get_required_fields()
        return all(config.get(field) for field in required)

    async def send(
        self,
        alert_name: str,
        value: Any,
        condition: str,
        config: Dict[str, Any],
    ) -> bool:
        try:
            import paramiko
            from datetime import datetime

            host = config.get("host")
            port = int(config.get("port", 22))
            username = config.get("username")
            password = config.get("password")
            private_key_path = config.get("private_key_path")
            remote_path = config.get("remote_path")

            # Create file content
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            filename = f"alert_{alert_name.replace(' ', '_')}_{timestamp}.json"
            content = json.dumps({
                "alert_name": alert_name,
                "value": str(value),
                "condition": condition,
                "timestamp": datetime.utcnow().isoformat(),
            }, indent=2)

            # Connect and upload
            transport = paramiko.Transport((host, port))

            if private_key_path:
                private_key = paramiko.RSAKey.from_private_key_file(private_key_path)
                transport.connect(username=username, pkey=private_key)
            else:
                transport.connect(username=username, password=password)

            sftp = paramiko.SFTPClient.from_transport(transport)

            remote_file_path = f"{remote_path.rstrip('/')}/{filename}"
            with sftp.file(remote_file_path, "w") as f:
                f.write(content)

            sftp.close()
            transport.close()

            logger.info("SFTP alert uploaded for '%s' to %s", alert_name, remote_file_path)
            return True

        except Exception as e:
            logger.error("SFTP alert failed for '%s': %s", alert_name, e)
            return False


# Connector registry
CONNECTORS: Dict[str, type[AlertConnectorBase]] = {
    "email": EmailConnector,
    "slack": SlackConnector,
    "sftp": SFTPConnector,
}


def get_connector(connector_type: str) -> Optional[AlertConnectorBase]:
    """Get a connector instance by type."""
    connector_class = CONNECTORS.get(connector_type)
    if connector_class:
        return connector_class()
    return None


def validate_connector_config(connector_type: str, config: Dict[str, Any]) -> bool:
    """Validate configuration for a connector type."""
    connector_class = CONNECTORS.get(connector_type)
    if connector_class:
        return connector_class.validate_config(config)
    return False
