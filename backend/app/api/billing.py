"""Paystack + Flutterwave upgrades for Authority plan."""
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
from app.models.organization import Organization

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])

PLANS = {
    "authority_monthly": {
        "name": "CivicFault Authority",
        "amount": 150_000,
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
    plan_key: str = Field("authority_monthly")
    callback_url: Optional[str] = None
    provider: str = Field("paystack", pattern=r"^(paystack|flutterwave)$")


class VerifyPayment(BaseModel):
    reference: str
    provider: str = Field("paystack", pattern=r"^(paystack|flutterwave)$")


def _apply_plan(user: AuthorityUser, plan_key: str, db: Session):
    plan = PLANS.get(plan_key, PLANS["authority_monthly"])
    user.plan = plan["plan_code"]
    user.plan_expires_at = datetime.utcnow() + timedelta(days=plan["days"])
    db.add(user)
    if user.organization_id:
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if org:
            org.plan = plan["plan_code"]
            org.plan_expires_at = user.plan_expires_at
            db.add(org)
    db.commit()
    db.refresh(user)
    return plan


def _paystack_headers() -> dict:
    key = (settings.paystack_secret_key or "").strip()
    if not key:
        raise HTTPException(503, "Paystack not configured (PAYSTACK_SECRET_KEY)")
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


@router.get("/plans")
def list_plans():
    return {
        "providers": ["paystack", "flutterwave"],
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

    if body.provider == "flutterwave":
        return await _init_flutterwave(user, plan, body.plan_key, reference, callback)

    amount = plan["amount"]
    if plan["currency"] in ("NGN", "USD", "GHS"):
        amount = plan["amount"] * 100

    payload = {
        "email": user.email,
        "amount": amount,
        "currency": plan["currency"],
        "reference": reference,
        "callback_url": callback,
        "metadata": {
            "user_id": user.id,
            "plan_key": body.plan_key,
            "organization": user.organization or "",
        },
    }
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
        "provider": "paystack",
        "authorization_url": data["data"]["authorization_url"],
        "access_code": data["data"]["access_code"],
        "reference": data["data"]["reference"],
        "plan": body.plan_key,
    }


async def _init_flutterwave(user, plan, plan_key, reference, callback):
    secret = (settings.flutterwave_secret_key or "").strip()
    if not secret:
        raise HTTPException(503, "Flutterwave not configured (FLUTTERWAVE_SECRET_KEY)")

    payload = {
        "tx_ref": reference,
        "amount": plan["amount"],
        "currency": plan["currency"],
        "redirect_url": callback,
        "customer": {"email": user.email, "name": user.full_name or user.email},
        "customizations": {
            "title": plan["name"],
            "description": f"CivicFault {plan_key}",
        },
        "meta": {"user_id": user.id, "plan_key": plan_key},
    }
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.flutterwave.com/v3/payments",
            headers={
                "Authorization": f"Bearer {secret}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    data = r.json()
    if not r.is_success or data.get("status") != "success":
        logger.error("Flutterwave init failed: %s", data)
        raise HTTPException(502, data.get("message") or "Flutterwave initialize failed")

    return {
        "provider": "flutterwave",
        "authorization_url": data["data"]["link"],
        "reference": reference,
        "plan": plan_key,
    }


@router.post("/verify")
async def verify_payment(
    body: VerifyPayment,
    user: AuthorityUser = Depends(get_current_authority),
    db: Session = Depends(get_db),
):
    if body.provider == "flutterwave":
        return await _verify_flutterwave(body.reference, user, db)

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
    plan = _apply_plan(user, plan_key, db)
    return {
        "ok": True,
        "provider": "paystack",
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at,
        "reference": body.reference,
        "days": plan["days"],
    }


async def _verify_flutterwave(reference: str, user: AuthorityUser, db: Session):
    secret = (settings.flutterwave_secret_key or "").strip()
    if not secret:
        raise HTTPException(503, "Flutterwave not configured")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref={reference}",
            headers={"Authorization": f"Bearer {secret}"},
        )
    data = r.json()
    if data.get("status") != "success":
        raise HTTPException(400, data.get("message") or "Verification failed")
    tx = data.get("data") or {}
    if str(tx.get("status", "")).lower() not in ("successful", "success"):
        raise HTTPException(400, f"Payment not successful: {tx.get('status')}")
    meta = tx.get("meta") or {}
    plan_key = meta.get("plan_key") or "authority_monthly"
    plan = _apply_plan(user, plan_key, db)
    return {
        "ok": True,
        "provider": "flutterwave",
        "plan": user.plan,
        "plan_expires_at": user.plan_expires_at,
        "reference": reference,
        "days": plan["days"],
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
        return {"received": True}
    user = db.query(AuthorityUser).filter(AuthorityUser.id == int(user_id)).first()
    if not user:
        return {"received": True}
    _apply_plan(user, plan_key, db)
    return {"received": True, "upgraded": user.email}
