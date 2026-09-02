# Mark Cross — Client Onboarding & Access Status

**Date:** 2026-09-02
**Client:** Mark Cross (luxury leather goods — markcross.com)
**Setup modeled on:** Stolberg (housework-api client integration pattern)

---

## Access status

| System | Status | Detail |
|---|---|---|
| Google Ads | ✅ **Linked** | Client account **455-403-3676 (Mark Cross)** accepted the link to manager account **Clifford Press (219-394-7711)** on 2026-09-02. Reads go through the manager login, same as A. Clifford. |
| Meta — Page | ✅ **Granted** | Page **Mark Cross** (ID `100542473354908`) shared into the housework Business Manager (`1728203510834209`) on 2026-08-28. |
| Meta — Ad account | ✅ **Live** | "Mark Cross Ad Account" (`act_341898973409009`, ACTIVE) shared into the BM and assigned to the system user; audited 9/2. Note: `/me/adaccounts` lagged the assignment, so the integration probes the account ID directly. |
| housework-api | ✅ **Deployed** | `lib/markcross` + `/api/markcross-dashboard-data` + `/api/markcross-audit` pushed to `main` (commit `6facfdd`), Vercel deploys from main. |
| Shopify | ⏳ **Code deployed, needs credentials** | Andrew has store access. Create a custom app in the Mark Cross Shopify admin (Settings → Apps and sales channels → Develop apps → Create app → Admin API scope `read_orders` → install → copy token), then set in Vercel: `MARKCROSS_SHOPIFY_DOMAIN` (the `*.myshopify.com` domain) and `MARKCROSS_SHOPIFY_ACCESS_TOKEN`. Dashboard picks it up automatically (`sources.shopify` flips true). |
| GA4 | ⏳ **Code deployed, needs property + access** | Andrew checking access. Add the service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL` in Vercel) as **Viewer** on the Mark Cross GA4 property (Admin → Property access management), then set `MARKCROSS_GA4_PROPERTY_ID` in Vercel (Admin → Property settings → Property ID, digits only). |
| Klaviyo | ❌ Not connected | Stolberg-parity extra; add later if wanted. |

## housework-api integration

- `lib/markcross/google-ads.ts` — REST reader, customer `4554033676`, `login-customer-id` = manager `2193947711`.
- `lib/markcross/meta-ads.ts` — shared BM token; runtime discovery matches an ad account named "Mark Cross". Once the real account ID is known, hardcode it (and/or set `MARKCROSS_META_AD_ACCOUNT_ID` in Vercel) and delete the discovery.
- `GET /api/markcross-dashboard-data?from=YYYY-MM-DD&to=YYYY-MM-DD` — daily Google/Meta spend, platform-attributed conversions, ROAS.
- `GET /api/markcross-audit` — read-only: account settings, enabled conversion actions, 30/90-day campaign performance on both platforms, plus access diagnostics.

Both routes are currently in the middleware's open `DASHBOARD_ROUTES` set (same posture as the Stolberg report routes) so audits can run without a key. Move them behind per-client auth together with the other dashboards.

## Next steps

1. Client to share the Meta **ad account** with the housework BM (Page alone is not enough to read spend).
2. Re-run `/api/markcross-audit` once granted to complete the Meta half of the audit.
3. Decide on Shopify/GA4 connections for full-funnel (MER/CAC) reporting like Stolberg.
