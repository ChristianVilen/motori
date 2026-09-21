# Cloudflare R2 provisioning

`provision.sh` creates the four EU buckets (`motori-images`, `motori-docs`,
`motori-backups`, `motori-observability`) and connects `images.motori.fi` to
`motori-images`. It runs wrangler through `pnpm dlx`, so nothing is installed
globally. Log in once with `pnpm dlx wrangler login`, then:

    CF_ZONE_ID=<motori.fi zone id> CLOUDFLARE_ACCOUNT_ID=<account id> infra/r2/provision.sh

`provision.sh` also sets the lifecycle rule `expire-dumps-30d` (30-day expiry,
whole bucket) on `motori-backups`. The bucket lock `lock-dumps-14d` (14-day Age
rule) is applied only when `R2_APPLY_LOCK=1` is set. It goes on only at the end
of the cutover window after the validation gates pass, because a locked bucket
cannot be emptied (#230). Both rules are set with wrangler because the JS SDK
cannot set lifecycle rules on R2.

## Manual steps wrangler cannot do

1. R2 subscription: R2 Object Storage in the dashboard, complete the checkout.
2. S3 API tokens: R2 Object Storage > Account Details > Manage API Tokens.
   Permission Object Read & Write, scoped to the buckets below. Copy the
   Access Key ID and the Secret Access Key from the result screen.

   | Token             | Buckets                                                           |
   | ----------------- | ----------------------------------------------------------------- |
   | motori-app        | motori-images                                                     |
   | talli-app         | motori-images, motori-docs                                        |
   | dokku-backups     | motori-backups                                                    |
   | openobserve       | motori-observability                                              |
   | r2-migration-temp | all four; created at window start, revoked at the end or on abort |

3. Cache Rule on the motori.fi zone: Caching > Cache Rules > Create rule,
   expression `(http.host eq "images.motori.fi")`, cache eligibility
   Bypass cache. Images are then served without edge caching.
