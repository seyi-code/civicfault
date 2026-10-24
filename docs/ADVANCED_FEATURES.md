# CivicFault advanced features

## Private estate / org workspace

1. Sign in at `/authority`
2. **Create private workspace** (name + slug)
3. Reports can be scoped with `org_slug` on create; workspace list uses `/api/v1/reports/workspace`

API:
- `POST /api/v1/orgs`
- `GET /api/v1/orgs/me`
- `PATCH /api/v1/orgs/me`
- `GET /api/v1/orgs/by-slug/{slug}`
- `GET /api/v1/orgs/by-host?host=kcca.civicfault.app`

## SLA

Default 72 hours (per org `sla_hours`). Each report response includes:
- `hours_open`
- `is_overdue`
- `sla_hours`

Authority UI shows **Overdue** badge + open/overdue/resolved stats.

## WhatsApp / SMS digest

Railway env (pick one provider):

```
NOTIFY_PROVIDER=africastalking
AFRICASTALKING_USERNAME=...
AFRICASTALKING_API_KEY=...
AFRICASTALKING_FROM=CivicFault
```

or

```
NOTIFY_PROVIDER=twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM=+1...
TWILIO_WHATSAPP_FROM=whatsapp:+1...
```

Then on Authority: set phone → **Send now** (`POST /api/v1/orgs/me/digest`).

For weekly automation, call that endpoint from Railway cron or an external scheduler with a service token later.

## Paystack + Flutterwave

```
PAYSTACK_SECRET_KEY=sk_...
PAYSTACK_PUBLIC_KEY=pk_...
FLUTTERWAVE_SECRET_KEY=FLWSECK_...
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK_...
```

Authority page: **Paystack** and **Flutterwave** buttons.

## White-label

1. Set org `custom_domain` or use `slug` with `*.civicfault.app` when DNS is ready.
2. Frontend/host resolves branding via `GET /api/v1/orgs/by-host?host=...`
3. Point DNS CNAME to Vercel; add domain in Vercel project settings.

## Durable images (required for production)

See `docs/STORAGE_R2.md` — local Railway disk loses files on redeploy.
