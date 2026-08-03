# Google Ads Conversion: "99 kr." (AW-805899643)

Setup guide for the conversion action s360 (`tbj@s360digital.com`) shared for the `/99kr`
first-climb day ticket.

| Field | Value |
|-------|-------|
| Conversion name | `99 kr.` |
| Conversion ID | `805899643` (tag ID `AW-805899643`) |
| Conversion label | `1NImCKjKItscEPuapIAD` — **verify before saving, see below** |
| Currency | `DKK` |
| Default value | `1.0` (overridden with the real order value, see Step 4) |
| Data Layer event | `purchase_99kr` |
| GTM web container | `GTM-KHB92N9P` |

> **Verify the conversion label character by character.** The label contains a glyph that renders
> identically as capital `I` and lowercase `l` in the Google Ads UI and in the email s360 sent
> (`1NImCKjK` **I/l** `tscEPuapIAD`). Copy it straight from Google Ads → Goals → Conversions →
> `99 kr.` → *Tag setup*, and paste it into GTM. A wrong character silently records zero
> conversions.

---

## Do not paste the gtag snippet into `index.html`

The email offers a raw `gtag.js` global site tag plus an event snippet. Do **not** use that path on
this site:

- `index.html` already loads GTM (`GTM-KHB92N9P`) as the only tag loader, plus Google Consent Mode
  v2 defaults that must run before any Google tag. A second, hard-coded `gtag('config', 'AW-…')`
  would load a competing Google tag and double-count.
- The conversion page is not a separate URL. `/99kr` is an SPA route in `app.js`; the confirmation
  step renders client-side after the payment provider redirect, so a static event snippet in the
  page `<head>` would fire on load rather than on a completed order.
- The flow already emits everything the tag needs on the Data Layer, deduplicated per order.

Use the **Google Tag Manager** path (the tab selected in the Google Ads screenshot).

---

## What the site already sends

`trackConfirmedPurchase()` in `app.js` dual-fires on a completed `/99kr` order: the standard
`purchase` event (revenue reporting) and a dedicated `purchase_99kr` event (this conversion).
Both carry the same `transaction_id`. The guard in `isPurchaseAlreadyTracked()` keeps a reload of
the confirmation page from firing either event twice.

```javascript
{
  event: 'purchase_99kr',
  ecommerce: {
    transaction_id: '817247',   // BRP order number
    value: 99,
    currency: 'DKK',
    tax: 0,
    shipping: 0,
    items: [{
      item_id: '4711',
      item_name: 'Din første klatretur',
      price: 99,
      quantity: 1,
      item_category: 'entry',              // BRP product type; not used by the conversion tag
      item_category2: 'Boulders Sydhavn'   // gym name
    }]
  },
  gym_id: '1',
  payment_type: 'card',
  landing_path: '/99kr',
  event_id: 'purchase:817247:99kr',

  // user-provided data for enhanced conversions (plain text; Google hashes client-side)
  email: 'name@example.com',
  phone: '4512345678',          // digits only — Meta CAPI format
  phone_e164: '+4512345678',    // Google enhanced conversions format
  fn: 'Firstname',
  ln: 'Lastname',
  zip: '2450',
  ct: 'København',
  country: 'dk',
  external_id: '123456'
}
```

The gym name is on the item as `item_category2`, not as a top-level key.

Keys are omitted entirely when BRP or the checkout form did not supply a value — `st` (region) is
usually absent for Danish customers, and `phone` / `phone_e164` are absent when no phone was
captured. Treat every user-data field as optional in GTM so a missing value never blocks the tag.

---

## Step 0 — Deploy the CSP fix first

The conversion tag cannot load until the Content Security Policy that allows
`www.googleadservices.com` is live. Cloudflare Pages builds from the repo, so merging to `main`
deploys it; `_headers` is a Cloudflare Pages feature, and the GitHub Pages workflow in
`.github/workflows/deploy.yml` does not apply it. Confirm the deployed policy with:

```bash
curl -sI https://join.boulders.dk/99kr | tr ';' '\n' | grep 'script-src' | grep -o googleadservices
```

If that prints nothing, the fix is not live yet and every step below will appear to work in GTM
Preview while recording nothing in Google Ads. Check `script-src` specifically — the policy already
allowed `*.googleadservices.com` under `connect-src`, so grepping the whole header gives a false
positive.

## Step 1 — Data Layer variables

Create these under **Variables → New → Data Layer Variable** (Version 2) if they do not already
exist. Reuse the container's existing equivalents instead of creating duplicates.

| Variable name | Data Layer Variable Name |
|---------------|--------------------------|
| `DLV - ecommerce.value` | `ecommerce.value` |
| `DLV - ecommerce.currency` | `ecommerce.currency` |
| `DLV - ecommerce.transaction_id` | `ecommerce.transaction_id` |
| `DLV - email` | `email` |
| `DLV - phone_e164` | `phone_e164` |
| `DLV - fn` | `fn` |
| `DLV - ln` | `ln` |
| `DLV - zip` | `zip` |
| `DLV - ct` | `ct` |
| `DLV - st` | `st` |
| `DLV - country` | `country` |

## Step 2 — Trigger

**Triggers → New → Custom Event**

- Event name: `purchase_99kr`
- This trigger fires on: **All Custom Events**
- Name: `CE - purchase_99kr`

Do not trigger this conversion on `purchase`. That event also fires for memberships and punch
cards, which are not this conversion action.

## Step 3 — Conversion Linker

The container already serves the agency's `--GAds -` tags, so a **Conversion Linker** tag on *All
Pages* most likely exists. Confirm it does (**Tags** → look for tag type *Conversion Linker*) and
only create one if it is missing:

- Tag type: **Conversion Linker**
- Enable linking across domains: leave off (single domain, `join.boulders.dk`)
- Trigger: **All Pages**

Without it, `gclid` is not persisted and click-through conversions go unattributed.

## Step 4 — Google Ads Conversion Tracking tag

**Tags → New → Google Ads Conversion Tracking**

| Setting | Value |
|---------|-------|
| Conversion ID | `805899643` |
| Conversion Label | paste from Google Ads (see the warning at the top) |
| Conversion Value | `{{DLV - ecommerce.value}}` |
| Currency Code | `{{DLV - ecommerce.currency}}` |
| Order ID | `{{DLV - ecommerce.transaction_id}}` |
| Trigger | `CE - purchase_99kr` |
| Name | `GAds - Conversion - 99 kr day ticket` |

`Order ID` is what makes Google drop duplicates if the same order is ever reported twice (for
example a client-side and a server-side hit), so it must not be left blank.

The conversion action was created with a fixed value of `1.0 DKK`. Passing `{{DLV -
ecommerce.value}}` reports the actual paid amount (`99`, or less with a discount code), but only if
the conversion action in Google Ads is set to **Use different values for each conversion** — with
the default *Use the same value*, Google ignores the value the tag sends. Set that under
Goals → Conversions → `99 kr.` → *Edit settings* → *Value*, keeping `1 DKK` as the fallback for
hits that arrive without a value. If s360 would rather keep a flat value, leave the tag's value
field empty instead of hard-coding `1`.

### Enhanced conversions (optional but recommended)

Enhanced conversions must first be switched on for the conversion action in Google Ads
(Goals → Conversions → `99 kr.` → *Enhanced conversions* → accept the customer data terms, method
**Google Tag Manager**). Then wire the data up in GTM.

First create the user data variable — **Variables → New → User-Provided Data** (under *Utilities*),
type **Manual configuration**:

| Google field | Variable |
|--------------|----------|
| Email | `{{DLV - email}}` |
| Phone Number | `{{DLV - phone_e164}}` |
| First Name | `{{DLV - fn}}` |
| Last Name | `{{DLV - ln}}` |
| Street | *(leave empty — street address is not published to the Data Layer)* |
| City | `{{DLV - ct}}` |
| Region | `{{DLV - st}}` |
| Postal Code | `{{DLV - zip}}` |
| Country | `{{DLV - country}}` |

Name it `UPD - Purchase`.

Then in the `GAds - Conversion - 99 kr day ticket` tag, tick **Include user-provided data from your
website** and select `UPD - Purchase`.

Use `phone_e164`, not `phone`. Google requires E.164 (`+45…`); the digits-only `phone` field exists
for Meta CAPI and would be discarded.

### Consent settings

The site defaults `ad_storage`, `ad_user_data` and `ad_personalization` to `denied` and lets
Cookiebot update them (`index.html`), with `ads_data_redaction` on. Leave the tag's **Consent
Settings** at *No additional consent required* — the Google Ads tag reads Consent Mode itself and
sends cookieless pings for modeling when consent is missing. Adding a manual consent check on top
of it suppresses those pings and loses modeled conversions.

## Step 5 — Publish

Publish the container with a description such as
`Add Google Ads 99 kr day-ticket conversion (AW-805899643) on purchase_99kr`.

Per `docs/GTM_SEPARATE_CONFIG_SETUP.md`, do not modify the existing `Boulders DK` Google tag
(`G-7YMD7FSKMZ`), the `--GA4 - Event -` tags, or any other `--GAds -` tag while doing this.

---

## Verification

### 1. Data Layer (no GTM access needed)

On a `/99kr` confirmation page:

```javascript
window.dataLayer.filter(e => e.event === 'purchase_99kr')
```

Expect exactly one entry, with `ecommerce.value`, `ecommerce.currency` and
`ecommerce.transaction_id` populated.

### 2. GTM Preview

1. **Preview** in GTM → `https://join.boulders.dk/99kr`
2. Complete a real day-ticket purchase (the flow blocks accounts that already used the offer, so
   use an email that has not).
3. On the `purchase_99kr` event, confirm `GAds - Conversion - 99 kr day ticket` is under *Tags
   Fired* exactly once, and that the tag's value, currency and order ID are filled in.

### 3. Network

Look for a request to `https://www.googleadservices.com/pagead/conversion/805899643/` (or
`https://www.google.com/pagead/1p-conversion/805899643/`) returning 200 — not `blocked:csp`.

The CSP in `_headers` was extended to cover the domains Google lists for Conversion / Remarketing /
Conversion Linker tags: `www.googleadservices.com`, `www.google.com` and
`pagead2.googlesyndication.com` in `script-src`; `google.com` and `www.google.dk` in `connect-src`;
`*.doubleclick.net` in `frame-src` for the legacy view-through conversion iframe. Before that
change, `conversion_async.js` was blocked outright, so the tag could never have recorded anything.

If Tag Assistant reports a CSP issue for a domain not on that list, add it to `_headers` — the
browser blocks the request before it ever reaches Google, and neither GTM nor Google Ads reports
an error when that happens.

The same gap applied to any Google Ads conversion tag that already existed in the container, so
check whether the agency's other `--GAds -` conversions start recording again after this deploy.

### 4. Google Ads

Goals → Conversions → `99 kr.` moves from *No recent conversions* to *Recording conversions*.
Allow up to ~24h; conversions can take up to 3h to appear even when the tag is correct.
