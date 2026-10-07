"""Outbound email over the existing SMTP configuration.

Every mailer in this app (OTP codes in `routers/auth.py`, team invites in
`routers/users.py`) reads the same environment variables:

    SMTP_SERVER    default smtp.gmail.com
    SMTP_PORT      default 587
    SENDER_EMAIL   required
    SENDER_PASSWORD required  (Gmail app password, etc.)

Scheduled reports reuse those settings rather than introducing a second mail
transport, so operators configure SMTP in exactly one place. This module owns
the shared plumbing plus a report-specific HTML body; the router decides when
to call it.

Failure policy: `send_email` raises `EmailNotConfigured` when SMTP is unset and
lets `smtplib` errors propagate, so callers can record a truthful delivery
status instead of pretending a send happened.
"""
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Sequence


class EmailNotConfigured(RuntimeError):
    """SMTP_SERVER/SENDER_* are absent, so no mail can be sent."""


def smtp_settings() -> tuple:
    """Return (server, port, sender_email, sender_password).

    Raises EmailNotConfigured when credentials are missing rather than
    defaulting to a blank sender, which would produce a confusing 5xx from the
    SMTP server instead of a clear local error.
    """
    server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")

    if not sender_email or not sender_password:
        raise EmailNotConfigured(
            "SENDER_EMAIL/SENDER_PASSWORD environment variables are missing"
        )
    return server, port, sender_email, sender_password


def send_email(to: Sequence[str], subject: str, html_body: str) -> int:
    """Send one HTML message to every address in `to`. Returns the count sent.

    All recipients go on a single message (To: header lists them all) so the
    report is delivered as one mail rather than N near-identical copies.
    """
    server, port, sender_email, sender_password = smtp_settings()
    recipients = [addr for addr in to if addr]
    if not recipients:
        return 0

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"MarketMind AI <{sender_email}>"
    message["To"] = ", ".join(recipients)
    message.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(server, port, timeout=15) as smtp:
        smtp.starttls()
        smtp.login(sender_email, sender_password)
        smtp.sendmail(sender_email, recipients, message.as_string())
    return len(recipients)


# ── Scheduled-report body ──────────────────────────────────────────────

REPORT_TITLES = {
    "sales-summary": "Sales Summary",
    "inventory-report": "Inventory Report",
    "customer-report": "Customer Report",
    "anomaly-report": "Anomaly Report",
}


def _money(value) -> str:
    try:
        return f"₹{float(value or 0):,.2f}"
    except (TypeError, ValueError):
        return "₹0.00"


def build_report_email(
    report_type: str,
    payload: dict,
    company_name: str,
    app_url: str = None,
) -> tuple:
    """Render (subject, html) for a scheduled report from its live payload.

    The payload comes from `_build_report_payload`, i.e. the same KPI numbers
    the dashboard shows, so the email cannot drift from the app.
    """
    title = REPORT_TITLES.get(report_type, report_type.replace("-", " ").title())
    generated = payload.get("generated_at", "")
    app_url = (app_url or os.getenv("APP_URL", "http://localhost:5173")).rstrip("/")

    metrics = [
        ("Total revenue", _money(payload.get("total_revenue"))),
        ("Total sales", payload.get("total_sales", 0)),
        ("Customers", payload.get("total_customers", 0)),
        ("Products", payload.get("total_products", 0)),
        ("Low stock items", payload.get("low_stock_count", 0)),
        ("Pending invoices", payload.get("pending_invoices", 0)),
        ("Overdue invoices", payload.get("overdue_invoices", 0)),
    ]
    if "anomaly_count" in payload:
        metrics.append(("Anomalies detected", payload.get("anomaly_count", 0)))

    rows = "".join(
        f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">{label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;
                     font-weight:bold;color:#1f2937;">{value}</td>
        </tr>"""
        for label, value in metrics
    )

    top_products = payload.get("top_products") or []
    product_rows = ""
    for product in top_products[:5]:
        name = product.get("name") if isinstance(product, dict) else str(product)
        product_rows += (
            f"<li style='margin:4px 0;'>{name}</li>"
        )
    top_block = (
        f"<h3 style='margin:22px 0 6px;color:#2e2b8f;'>Top products</h3>"
        f"<ul style='margin:0;padding-left:20px;color:#555;'>{product_rows}</ul>"
        if product_rows
        else ""
    )

    html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;
                   background:#f5f5fa; margin:0; padding:24px;">
        <div style="max-width: 560px; margin: 0 auto; background:#fff;
                    border:1px solid #e0e0e0; border-radius:12px; padding:28px;">
          <h2 style="color:#2e2b8f; margin-top:0;">{title}</h2>
          <p style="color:#666; margin-top:0;">
            {company_name} &middot; generated {generated}
          </p>

          <table style="width:100%; border-collapse:collapse; margin-top:16px;">
            {rows}
          </table>

          {top_block}

          <p style="margin-top:26px;">
            <a href="{app_url}/reports"
               style="display:inline-block; background:#2e2b8f; color:#ffffff;
                      text-decoration:none; padding:10px 22px; border-radius:8px;
                      font-weight:bold;">Open in MarketMind AI</a>
          </p>
          <p style="font-size:12px;color:#999;">
            You are receiving this because a scheduled report is configured for
            your account. Manage schedules under Reports.
          </p>
        </div>
      </body>
    </html>
    """

    subject = f"{title} — {company_name}"
    return subject, html


def parse_recipients(raw: str) -> List[str]:
    """Decode the JSON array stored on ScheduledReport.recipients.

    Returns [] for blank/malformed input rather than raising: a corrupt row
    must not break the scheduler tick for every other schedule.
    """
    if not raw:
        return []
    try:
        import json

        parsed = json.loads(raw)
    except (ValueError, TypeError):
        return []
    if not isinstance(parsed, list):
        return []
    return [str(a).strip() for a in parsed if str(a).strip()]