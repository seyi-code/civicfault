"""WhatsApp / SMS via Africa's Talking or Twilio."""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _normalize_phone(phone: str) -> str:
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("0") and len(p) == 10:
        p = "+256" + p[1:]  # Uganda local → E.164
    if not p.startswith("+"):
        p = "+" + p
    return p


async def send_whatsapp_or_sms(phone: str, message: str) -> dict:
    phone = _normalize_phone(phone)
    provider = (settings.notify_provider or "africastalking").lower()

    if provider == "twilio":
        return await _twilio(phone, message)
    return await _africastalking(phone, message)


async def _africastalking(phone: str, message: str) -> dict:
    username = settings.africastalking_username
    api_key = settings.africastalking_api_key
    sender = settings.africastalking_from or "CivicFault"
    if not username or not api_key:
        raise RuntimeError("Africa's Talking not configured")

    # SMS API (WhatsApp Business requires extra AT product; SMS works widely)
    url = "https://api.africastalking.com/version1/messaging"
    headers = {
        "apiKey": api_key,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }
    data = {
        "username": username,
        "to": phone,
        "message": message,
        "from": sender,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers=headers, data=data)
    body = r.json() if r.content else {}
    if r.status_code >= 400:
        logger.error("AT send failed: %s %s", r.status_code, body)
        raise RuntimeError(body.get("message") or "Africa's Talking send failed")
    return {"provider": "africastalking", "result": body}


async def _twilio(phone: str, message: str) -> dict:
    sid = settings.twilio_account_sid
    token = settings.twilio_auth_token
    from_num = settings.twilio_whatsapp_from or settings.twilio_sms_from
    if not sid or not token or not from_num:
        raise RuntimeError("Twilio not configured")

    # Prefer WhatsApp channel if from is whatsapp:+...
    to = phone if from_num.startswith("whatsapp:") else phone
    if from_num.startswith("whatsapp:") and not to.startswith("whatsapp:"):
        to = f"whatsapp:{phone}"

    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            url,
            data={"From": from_num, "To": to, "Body": message},
            auth=(sid, token),
        )
    body = r.json() if r.content else {}
    if r.status_code >= 400:
        logger.error("Twilio send failed: %s %s", r.status_code, body)
        raise RuntimeError(body.get("message") or "Twilio send failed")
    return {"provider": "twilio", "sid": body.get("sid")}
