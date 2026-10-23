# Durable image storage (Cloudflare R2 or S3)

Railway local disk can reset on redeploy. Use object storage for production images.

## Cloudflare R2 (recommended — cheap, S3-compatible)

1. Create an R2 bucket in Cloudflare dashboard.
2. Enable public access or a custom domain / r2.dev public URL.
3. Create an API token with Object Read & Write.
4. On Railway **civicfault** service → Variables:

```
STORAGE_BACKEND=s3
S3_BUCKET=your-bucket-name
S3_REGION=auto
S3_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY=<r2_access_key_id>
S3_SECRET_KEY=<r2_secret_access_key>
S3_PUBLIC_BASE_URL=https://pub-xxxx.r2.dev
```

5. Redeploy the API. New uploads go to R2; `image_url` becomes a full public HTTPS URL.

## AWS S3

Same variables; omit `S3_ENDPOINT_URL` (or leave empty). Set `S3_REGION` e.g. `eu-west-1` and a public bucket/CDN URL in `S3_PUBLIC_BASE_URL`.
