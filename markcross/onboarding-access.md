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
| Meta — Ad account | ⚠️ **Not yet shared** | No ad-account grant has arrived — only the Page. The integration discovers the ad account by name at runtime and reports "not connected" until the client shares it. **Action: ask the client to share their ad account (Business Settings → Ad Accounts → Assign Partner, business ID 1728203510834209).** |
| housework-api | ✅ **Deployed** | `lib/markcross` + `/api/markcross-dashboard-data` + `/api/markcross-audit` pushed to `main` (commit `6facfdd`), Vercel deploys from main. |
| Shopify / GA4 / Klaviyo | ❌ Not connected | Stolberg-parity extras. Add when credentials exist; the dashboard route is shaped to grow into the Stolberg response. |

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
