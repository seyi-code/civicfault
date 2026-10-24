"""Paystack subscription / one-time upgrade for Authority plan."""
from __future__ import annotations

import hashlib
import hmac
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_authority
from app.db.session import get_db
from app.models.user import AuthorityUser

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])

# Amounts in smallest currency unit (kobo for NGN, cents for USD).
# Default: UGX — Paystack Uganda supports UGX; amount in shillings (no subunit).
PLANS = {
    "authority_monthly": {
        "name": "CivicFault Authority",
        "amount": 150_000,  # UGX 150,000 / month (adjust freely)
        "currency": "UGX",
        "days": 30,
        "plan_code": "authority",
    },
    "authority_yearly": {
        "name": "CivicFault Authority (Yearly)",
        "amount": 1_500_000,
        "currency": "UGX",
        "days": 365,
        "plan_code": "authority",
    },
}


class InitPayment(BaseModel):
    plan_key: str = Field("authority_monthly", description="authority_monthly | authority_yearly")
    callback_url: Optional[str] = None


class VerifyPayment(BaseModel):
    reference: str


def _paystack_headers() -> dict:
    key = (settings.paystack_secret_key or "").strip()
    if not key:
        raise HTTPException(503, "Paystack not configured (PAYSTACK_SECRET_KEY)")
    return {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


@router.get("/plans")
def list_plans():
    return {
        "provider": "paystack",
        "plans": [
            {
                "key": k,
                "name": v["name"],
                "amount": v["amount"],
                "currency": v["currency"],
                "days": v["days"],
            }
            for k, v in PLANS.items()
        ],
    }


@router.post("/initialize")
async def initialize_payment(
    body: InitPayment,
    user: AuthorityUser = Depends(get_current_authority),
    db: Session = Depends(get_db),
):
    plan = PLANS.get(body.plan_key)
    if not plan:
        raise HTTPException(400, f"Unknown plan. Choose: {list(PLANS)}")

    callback = body.callback_url or settings.paystack_callback_url or (
        "https://civicfault.vercel.app/authority?paid=1"
    )
    reference = f"cf_{user.id}_{body.plan_key}_{int(datetime.utcnow().timestamp())}"

    payload = {
        "email": user.email,
        "amount": plan["amount"] * (100 if plan["currency"] in ("NGN", "USD", "GHS") else 1),
        "currency": plan["currency"],
        "reference": reference,
        "callback_url": callback,
        "metadata": {
            "user_id": user.id,
            "plan_key": body.plan_key,
            "organization": user.organization or "",
        },
    }
    # UGX on Paystack is in major units (no *100). NGN uses kobo.
    if plan["currency"] == "UGX":
        payload["amount"] = plan["amount"]

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.paystack.co/transaction/initialize",
            headers=_paystack_headers(),
            json=payload,
        )
    data = r.json()
    if not r.is_success or not data.get("status"):
        logger.error("Paystack init failed: %s", data)
        raise HTTPException(502, data.get("message") or "Paystack initialize failed")

    return {
        "authorization_url": data["data"]["authorization_url"],
        "access_code": data["data"]["access_code"],
        "reference": data["data"]["reference"],
        "plan": body.plan_key,
    }


@router.post("/verify")
async def verify_payment(
    body: VerifyPayment,
    user: AuthorityUser = Depends(get_current_authority),
    db: Session = Depends(get_db),
):
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"https://api.paystack.co/transaction/verify/{body.reference}",
            headers=_paystack_headers(),
        )
    data = r.json()
    if not r.is_success or not data.get("status"):
        raise HTTPException(400, data.get("message") or "Verification failed")

    tx = data["data"]
    if tx.get("status") != "success":
        raise HTTPException(400, f"Payment not successful: {tx.get('status')}")

    meta = tx.get("metadata") or {}
    plan_key = meta.get("plan_key") or "authority_monthly"
    plan = PLANS.get(plan_key, PLANS["authority_monthly"])

    user.plan = plan["plan_code"]
    user.plan_expires_at = datetime.utcnow() + timedelta(days=plan["days"])
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "ok": True,
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at,
        "reference": body.reference,
    }


@router.post("/webhook")
async def paystack_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_paystack_signature: Optional[str] = Header(None),
):
    raw = await request.body()
    secret = (settings.paystack_secret_key or "").encode()
    if secret and x_paystack_signature:
        computed = hmac.new(secret, raw, hashlib.sha512).hexdigest()
        if not hmac.compare_digest(computed, x_paystack_signature):
            raise HTTPException(400, "Invalid signature")

    import json

    event = json.loads(raw)
    if event.get("event") != "charge.success":
        return {"received": True}

    data = event.get("data") or {}
    meta = data.get("metadata") or {}
    user_id = meta.get("user_id")
    plan_key = meta.get("plan_key") or "authority_monthly"
    if not user_id:
        return {"received": True, "note": "no user_id"}

    user = db.query(AuthorityUser).filter(AuthorityUser.id == int(user_id)).first()
    if not user:
        return {"received": True, "note": "user missing"}

    plan = PLANS.get(plan_key, PLANS["authority_monthly"])
    user.plan = plan["plan_code"]
    user.plan_expires_at = datetime.utcnow() + timedelta(days=plan["days"])
    db.add(user)
    db.commit()
    return {"received": True, "upgraded": user.email}
