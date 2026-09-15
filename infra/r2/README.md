# Cloudflare R2 provisioning

`provision.sh` creates the four EU buckets (`motori-images`, `motori-docs`,
`motori-backups`, `motori-observability`) and connects `images.motori.fi` to
`motori-images`. It runs wrangler through `pnpm dlx`, so nothing is installed
globally. Log in once with `pnpm dlx wrangler login`, then:

    CF_ZONE_ID=<motori.fi zone id> CLOUDFLARE_ACCOUNT_ID=<account id> infra/r2/provision.sh

Bucket lock and lifecycle rules are not created here. They are decided in
issue #230 and added in the cutover with `wrangler r2 bucket lock add` and
`wrangler r2 bucket lifecycle add`, both with `--jurisdiction eu`. The JS SDK
cannot set lifecycle rules on R2.

## Manual steps wrangler cannot do

1. R2 subscription: R2 Object Storage in the dashboard, complete the checkout.
2. S3 API tokens: R2 Object Storage > Account Details > Manage API Tokens.
   Permission Object Read & Write, scoped to the buckets below. Copy the
   Access Key ID and the Secret Access Key from the result screen.

   | Token         | Buckets                          |
   | ------------- | -------------------------------- |
   | motori-app    | motori-images                    |
   | talli-app     | motori-images, motori-docs       |
   | dokku-backups | motori-backups                   |
   | openobserve   | motori-observability             |
   | r2-drill-temp | all four, revoke after the drill |

3. Cache Rule on the motori.fi zone: Caching > Cache Rules > Create rule,
   expression `(http.host eq "images.motori.fi")`, cache eligibility
   Bypass cache. Images are then served without edge caching.
