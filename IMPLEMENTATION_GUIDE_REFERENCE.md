# Implementation Guide Reference

## Instructions
Paste the complete implementation guide text below this line. This file will be used to verify we haven't missed any details.

---

## Paste Guide Text Here:

Client-Side Implementation Steps
Simplified checklist for rebuilding every proxy feature in a client application while talking directly to the
Join Boulders API service.
Phase 1 · Prep Work
Phase 2 · Feature Flows
1. Lock the production backend URL
Hard-code https://api-join.boulders.dk wherever the client calls the Join Boulders API
service (production is the only environment today).
2. Set the language default
Add the production language (Danish da-DK ) next to the base URL so every request has a
starting locale.
Make sure the HTTP helper writes this value to the Accept-Language header for every call;
API3 relies on the header, not query parameters.
3. Business-unit picker
The very first screen should prompt the user to choose their bouldering location, mirroring the
stepper UI in the design (searchable list with one selectable venue).
Populate the list by calling the Join Boulders API service at https://apijoin.
boulders.dk/api/reference/business-units , then hold the app on this step until one
option is selected.
Store the chosen unit in client state so every later request can reference it—there is no default
fallback.
4. Reference data loader (as needed)
If the UI needs any lookups (for example, membership add-on metadata), fetch them after the
business unit is selected.
Cache responses in client state and refresh when the user switches units so data stays aligned.
5. Access type selection (membership vs punch card)
Fetch memberships by calling GET /api/products/subscriptions with the active business
unit and display them in the “Membership” option.
Fetch punch cards by calling GET /api/products/valuecards and wire the list into the “Punch
Card” choice.
When the user picks a membership, immediately request GET
/api/products/subscriptions/{productId}/additions to load the add-on products shown
in the “Add to your membership” step.
If the user confirms any additions, store the chosen add-on IDs alongside the membership
selection so they can be added to the order later.
When the user decides (membership or punch card), persist the access type, product ID, and
any selected additions so the next step knows which payloads to add to the order.
6. Authentication or account creation
Once the user confirms their access type (and membership add-ons if applicable), prompt them
to log in or create a BRP customer profile.
Phase 4 · Finishing Touches
Submit login credentials with POST /api/auth/login and store the returned access/refresh
tokens; for new users, post to /api/customers before continuing.
When login succeeds for the first time, persist the tokens in a small session store (memory-first
is fine) with helpers like saveTokens , getAccessToken , and clearTokens so the HTTP helper
can reuse them automatically.
Keep tokens fresh by calling POST /api/auth/validate when the app reloads with saved
credentials; if the access token is expired and a refresh token exists, call POST
/api/auth/refresh , otherwise clear the session and return to the auth step.
Offer a forgotten-password flow via POST /api/auth/reset-password , then confirm to the user
that instructions were sent.
When creating or updating customer details, call the Join Boulders API endpoints directly ( POST
/api/customers , PUT /api/customers/:id , POST /api/customers/:customerId/otheruser
) and always include the active business unit.
7. Order and items
Create the order by calling POST /api/orders .
Add the selected access product with POST /api/orders/{orderId}/items/subscriptions
(membership) or POST /api/orders/{orderId}/items/valuecards (punch card), using the
product ID stored in Step 5.
For any membership extras the user chose, call POST
/api/orders/{orderId}/items/articles for each addition.
When you need to review or update the order, use GET /api/orders/{orderId} or PUT
/api/orders/{orderId} and always include the active business unit in payloads.
8. Additional catalog items (optional)
To offer more products, fetch catalogs with GET /api/products or GET
/api/products/subscriptions/{productId}/additions and attach them to the order using
the relevant /api/orders/{orderId}/items/* endpoint.
9. Payment link flow
Use POST /api/payment/generate-link to create checkout URLs after an order is ready.
Pass the order ID, payment method, selected business unit, and the same return URL structure
documented for the Join Boulders API service so the backend can complete the flow.
Store the generated link in client state so the UI can display it or redirect the user.
10. Shared state wiring
Centralize session details, selected business unit, language, and reference data in a state
container or reactive store so every screen reads the same values.
Subscribe the HTTP helper to this store so updates propagate automatically.
11. End-to-end walkthroughs
Run through the full happy paths: pick business unit → load reference data → choose access
type (with add-ons) → log in or create account → order creation → payment link.
Use the same sample data the proxy tests rely on ( tests/ folder) to make sure client requests
match the server expectations.
Note any gaps that still depend on server-only utilities so we can plan lightweight replacements
later.
12. Guardian and child flows
Keep this list nearby while you build; each step brings the client closer to total parity with the original
proxy-backed workflow.
Analytics Integration
When a guardian needs to purchase for a child, call POST /api/customers with
isGuardianPurchase: true and include both guardian and customer objects (each
supplying email, name, birth date, businessUnit, and contact details).
The response returns both accounts; store their IDs so you can link orders and display
confirmations.
For existing customers, link or update relationships with POST
/api/customers/:customerId/other-user , passing the guardian’s ID in otherUserId and
the desired role (usually PAYER ).
Ensure subsequent order payloads reference the correct guardian/child IDs so payments and
membership ownership match the intended person.
13. Understand the goal
Server-side analytics in Join Boulders relies on two identifiers we send from the client: the GA4
client ID and, when available, the BRP customer ID.
Passing these IDs lets the platform connect “someone clicked checkout” (browser) with
“someone completed checkout” (API), so keep them in sync.
14. Load GA4 with consent defaults
Add the GA4 tag (via GTM or direct script) with Consent Mode set to deny analytics storage until
the user opts in.
As soon as the user grants marketing/analytics consent, call gtag('consent', 'update',
...) to allow storage.
Confirm the Measurement ID matches the value provided by the backend team; the server
assumes the same ID.
15. Capture the GA client identifier after opt-in
When consent flips to “granted”, call gtag('get', measurementId, 'client_id', cb) (or the
equivalent helper) and store the result in short-lived state that the HTTP layer can read.
If the user turns consent off, clear the stored ID immediately — do not persist it to disk or reuse
it.
16. Send analytics headers with funnel requests
Wrap the HTTP helper so it adds x-ga-client-id: <value> whenever the GA client ID is
present and consent is still true.
Add x-ga-user-id: <customerId> once the user is authenticated; reuse the customer ID you
already submit in order payloads.
Endpoints that need these headers: POST /api/orders , POST
/api/orders/{orderId}/items/subscriptions , POST
/api/orders/{orderId}/items/valuecards , POST
/api/orders/{orderId}/items/articles , and POST /api/payment/generate-link .
Skip both headers when consent is denied—the backend will fall back to anonymous tracking.
17. Optional QA check
In staging you can temporarily mirror these calls with client-side GA events to confirm stitching,
but disable duplicates once the backend events look correct.
## Verification Checklist

After pasting, we'll verify:
- [ ] All steps are documented
- [ ] All endpoints are listed
- [ ] All requirements are captured
- [ ] No details are missing from our implementation status
