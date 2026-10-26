# CivicFault deployment notes

## Durable images (Cloudflare R2 / S3)

Railway local disk is wiped on redeploy. Set on the **API** service:

```
STORAGE_BACKEND=s3
S3_BUCKET=your-bucket
S3_REGION=auto
S3_ENDPOINT_URL=https://<accountid>.r2.cloudflarestorage.com
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_PUBLIC_BASE_URL=https://pub-xxxxx.r2.dev
```

Make the bucket (or R2 public URL) readable so `image_url` works in the browser.

Install dependency if needed: `boto3` in `requirements.txt`.

## Platform admin repair

If an org creator was wrongly set to platform admin:

```bash
# Demote org user to manager
curl -X POST "$API/api/v1/orgs/admin/fix-user" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"lc1@kcca.co.ug","role":"manager"}'

# Keep only true platform admin global (clear org link)
curl -X POST "$API/api/v1/orgs/admin/fix-user" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"email":"logzmaster.biz@gmail.com","role":"admin","clear_organization":true}'
```

## Cron digests

`POST /api/v1/cron/digests` with header `X-Cron-Secret: $CRON_SECRET`

## Frontend

`NEXT_PUBLIC_API_URL=https://civicfault-api.up.railway.app`
