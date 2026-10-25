# CivicFault – Deploy & next steps

## Durable images (Cloudflare R2 / S3)

Railway local disk is **ephemeral**. Set these on the **API** service:

```
STORAGE_BACKEND=s3
S3_BUCKET=your-r2-bucket
S3_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_REGION=auto
S3_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
```

1. Create an R2 bucket → enable public access or custom domain.
2. Create API token with Object Read & Write.
3. Redeploy API. New uploads get permanent URLs; old `/static/uploads/...` links stay broken until re-filed.

## Paystack live

```
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_CALLBACK_URL=https://civicfault.vercel.app/authority?paid=1
```

## WhatsApp / SMS digest (Africa’s Talking)

```
NOTIFY_PROVIDER=africastalking
AFRICASTALKING_USERNAME=...
AFRICASTALKING_API_KEY=...
AFRICASTALKING_FROM=CIVICFAULT
CRON_SECRET=long-random-string
```

Cron (Railway cron or cron-job.org):

```
POST https://civicfault-api.up.railway.app/api/v1/cron/digests
Header: X-Cron-Secret: <CRON_SECRET>
```

Set org `notify_phone` in Authority workspace settings.

## YOLO

Leave `YOLO_MODEL_PATH` empty until you have labeled local images. Mock classifier stays on.

## Pilot customer checklist

1. Create workspace (slug e.g. `scode`).
2. Share resident link: `https://civicfault.vercel.app/?org=scode`
3. Invite 1–2 staff via Authority → Invite.
4. Grant plan if needed: platform admin `POST /api/v1/orgs/admin/set-plan`.
5. Turn on R2 before promising photo permanence.
