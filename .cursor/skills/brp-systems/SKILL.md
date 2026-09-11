---
name: brp-systems
description: "Working knowledge of BRP Systems (BRP Cloud), the CRM/booking/POS/access-control platform behind Boulders, including the GoActive app (BRP Mobility) and the REST APIs. Use whenever a task touches BRP, BRP Cloud, Back Office, Resource Planner, Point of Sale, Entrance View, BRP Configuration, GoActive, Mobility Web, Staff Center, BRP Loyalty, or the BRP API, or when answering questions about members, subscriptions, value cards, classes, bookings, entries, price lists, or gym access control at Boulders."
---

# BRP Systems (BRP Cloud)

BRP Cloud is the CRM, booking, POS and access-control platform that Boulders (Denmark's largest bouldering chain, 11 locations) runs on. Its member-facing surface is the GoActive app plus Mobility Web. This skill carries the domain model, the vocabulary, and a page index for looking up exact detail.

## Looking up detail

Documentation lives in Confluence at `https://brpsystems.atlassian.net/wiki` and is readable anonymously. To pull a specific page, use **WebFetch** (never curl or python requests):

- Page body: `https://brpsystems.atlassian.net/wiki/rest/api/content/{id}?expand=body.view` with a prompt like "Convert the page body HTML to complete markdown, verbatim, all table rows, no summarizing."
- List a space: `https://brpsystems.atlassian.net/wiki/rest/api/space/{KEY}/content/page?limit=100&start=0`
- Search: `https://brpsystems.atlassian.net/wiki/rest/api/search?cql=text~"your+terms"&limit=20`
- Human URL: `https://brpsystems.atlassian.net/wiki/spaces/{KEY}/pages/{id}`
Spaces: **DOC** (staff manual, EN), **BM** (BRP Mobility / GoActive), **API** (REST API2 reference), **DOK22** (Swedish docs, and the full API3 reference), **MC** (Member & Consumer), **HW** (Hardware), **EDU**, **PUB**.

Always verify a feature against a release tag before promising it exists: pages carry markers like `TP61451 / Cloud GA 2025.11` or `BRP-10807` naming the release that introduced the feature.

## The five staff modules

| Module | Purpose |
|---|---|
| **Back Office** | Person records, subscriptions, invoices, organizations, statistics, dashboards. Main admin hub. |
| **Resource Planner** | Calendar and scheduling. Resources, classes, service bookings, work shifts, schedule deviations. |
| **Point of Sale** | On-site register: items, subscriptions, entries, value cards, refunds, register reports. |
| **Entrance View** | Turnstile and reader traffic, entry/exit control, manual opening, result codes, sound settings. |
| **Configuration** | System admin: companies, facilities, products, price lists, accounts, VAT, roles and rights, app and web content. |

Member-facing: **BRP Mobility** = the GoActive app + Mobility Web, driven by an "App object" in Configuration. Staff have a separate **Staff Center** app.

## Core data model

- **Person**: the member record ("Person Card"). Tabs: basic info, marketing, messages, membership, activity/visits, finance (customer account, EFT/card mandates), invoices, signatures, loyalty, customer journal, history. May belong to an **Organization** that pays for or discounts purchases.
- **Product**: the base sellable entity. Types: `subscription`, `entry`, `valueCard`, `service`, `groupActivity` (class), `event`, `package`, `article` / `stockProduct`. The type drives behaviour everywhere else. Shared settings live on "General Settings for Products".
- **Subscription**: an instance of a subscription product owned by a person or organization. Binding period, debit interval, debited-until date, freeze deviations, termination date. Managed from the Subscriptions List.
- **Value card**: a "Sum" balance (gift-card style) or a clip card of preset products. Personal or organizational (org usage invoiced later). Can grant facility access. Expired cards are cleared in the monthly close.
- **Entry**: grants a time-limited right to be in the facility, often as a clip card.
- **Booking**: made against a **Resource** (room, staff, equipment), typed by **Resource Type**, bounded by **Schedules** (recurring opening hours) or **Work Shifts** (ad-hoc), governed by **Booking Rules** (how early/late, max simultaneous) and optional **Cancellation Policies** (fees).
- **Rights vs Roles**: *Rights* are member entitlements granted by owning a subscription, entry or value card; they gate facility entry, class booking and price-list access. *Roles* are staff permission bundles scoped to system, company or facility level. Admittance types and admittance rights connect rights to readers and schedules.
- **Company > Facility (business unit)**: the org hierarchy. Prices, products, content and reports can be scoped at either level. For a chain like Boulders this matters constantly, see "Central/Local Content in Mobility".
- **Product Groups** organize the POS/product-list hierarchy; **Product Labels** are freeform tags used for filtering (app/web class filters, campaign restrictions).

## Money and finance

- **Price lists** give one product several prices (member, student, and so on), applied by person, organization or right. Cheapest applicable price list wins; a manual POS price overrides everything. Prices can be facility- or company-scoped, date-ranged, or schedule-dependent (time-of-day). Bulk quantity discounts exist.
- **Accrual accounting**: subscription, event, service and item revenue is recognised over the earned period via monthly Deferred Revenue Journals, not when cash arrives.
- **Monthly close** ("Finance - Monthly Procedures"): unbalanced payments, clip-card post-billing, customer account invoicing, payment and invoice journals, register reports, clearing expired value cards, deferred revenue journal, stock transaction journal, export, reconciliation.
- **Dimensions** tag transactions with cost centre or project. Precedence: account > resource > product > register > customer > facility.
- Default accounts follow Swedish practice (1510 Accounts Receivable, 2610 Output VAT). "Accounting Entry Examples" has dozens of worked debit/credit cases.

## APIs

**API2** (the API space) is the older but live REST API.

- Auth: HTTP Basic (username = email, card number or customer number) plus `?apikey=...` on every request.
- Key levels: **Level 1** read-only GET. **Level 2** write, scoped to the logged-in person. **Level 3** system-to-system, IP whitelisted, can act on any person by passing an explicit `personid` / `userid` / `orderedbyid` (the exact param varies per object, see "Endpoints / Rest Objects"). Some calls need a higher "Read and change invoice" key, or a "remote" key (finvoice).
- API key values are shown once at creation and then hashed. BRP cannot redisplay them.
- Conventions: money is always integer minor units (`12500` = 125.00). Dates `yyyy-MM-DD`, times `HH:mm`, both Stockholm time, DST aware. Timestamps are Unix epoch seconds. Format chosen by `.json` or `.xml` suffix. Parameter names must be lowercase. Responses are UTF-8 since 2023-01-01.
- Gotcha: put `currentbusinessunitid` **first** in a query string, otherwise `&curr` gets mangled into a currency entity.
- Read before designing any purchase flow: "Examples for commonly used methods" (id 1948319452) and "Side effects and limitations for purchase flows and bookings" (id 1953627878). Hard limits include no partial invoice payment, no split or repeat billing, no price change on a live subscription.
- Preliminary orders auto-expire and are deleted if not finalized (`preliminary=false`) inside a configurable window. This is the usual cause of vanishing test orders.
- "Error codes" (id 1946812443) is the canonical numeric error list, grouped by domain.

**API3** is the newer, more RESTful API. Only pointer pages sit in the API space; the full reference lives in space **DOK22**. Under API3, anonymous orders require a `BRP-ORDER-KEY` header (part of the Right of Withdrawal work).

## BRP Mobility / GoActive configuration

- **App object** (Configuration): theme colours, fonts, texts, streamer, currency, languages, business unit, Google Tag Manager id, feature flags, magic download link with provider codes.
- **Web categories** build the Explore/Home page. Types: Title, Product, Information, Featured. Requires setting `mobilityEnableWebCategories` and the "Products - Create" right. Can be central, company or facility level for chains.
- **Message templates** supply all legal and info copy (opening hours, T&C, cookie policy) and resolve per business unit and language.
- **Feature tiers**: `appPremiumFeaturesActive` and `addonApp*FeaturesActive` gate Premium vs Base.
- Member flows documented end to end: class booking with waitlist and no-show fees, subscription purchase (including buying for someone else, DK Betalingsservice, NO AvtaleGiro, SE autogiro), freeze/unfreeze with staff-approved freeze requests, cancel and undo cancel, value cards, entry tickets and entrance packages, events, services, item sales, invoices and receipts, training history, registration and onboarding, consents, payment details, account deletion/anonymization.
- **Entrance tech**: Bluetooth beacons, dynamic Gantner GT7 QR, static printable QR, emergency PIN. `arriveInterval` controls the class check-in window.
- **Analytics**: Firebase SDK in the app, GTM + GA4 on web, Google Consent Mode v2, Meta Pixel. BRP's own access to a client's GA data can be disabled.
- **Accessibility**: WCAG 2.1 implementation notes for web and React Native, plus a Swedish accessibility statement (Tillgänglighetsredogörelse).

## Newer features (2025 to 2026)

- **Go Active! 2.0**: relaunch merging GoActive with Twiik. Explore becomes Home, adds My Training, Online Training, social feed and groups, carousels. Staff Center splits into its own app.
- **BRP Loyalty**: gamified points/coins/levels/achievements/challenges/streaks/rewards, built on the third-party platform **Gwen**. Levels are fixed at five (Start, Bronze, Silver, Gold, Elite) and cannot be renamed or rethresholded. Achievements are predefined (visible, easter-egg, hidden); Challenges are fully custom, max 100 challenges and 30 objectives. Needs setting `useLoyalty` and the `LoyaltySyncUsersScheduleTask` scheduled task. Rollout is a 5-phase process.
- **Book Together**: friend management, joint class bookings, shared entrance tickets. Mutually exclusive with Family Subscription Booking per app.
- **Right of Withdrawal**: EU Directive 2023/2673 compliance, deadline 19 June 2026. Checkout consent, self-service withdrawal page, Back Office processing, message templates.
- **Chat with us**: AI chatbot with two-layer guardrails (Google Model Armor plus a custom classifier), human escalation by email, covering bookings, subscriptions and invoices.
- **Integrations**: InBody, TechnoGym Enterprise, Smartum and Epassi wellness payments, Assently e-signature, Vipps identity fetch, finvoice (Finnish e-invoicing), cookie consent configuration, Lead forms.

## Page index

Fetch any of these with the WebFetch recipe at the top. Format: `title | id`.

### API space (API2 reference)

Endpoints / Rest Objects | 1985904421
Examples for commonly used methods | 1948319452
Side effects and limitations for purchase flows and bookings | 1953627878
Error codes | 1946812443
BRP API FAQ | 1991804104
API | 1985904401
API2 | 1985904408
API3 | 3981181045
Right of withdrawal (API3 changes) | 5549326339
restapihowtos2 | 1952284741
persons | 1946812429
persons (Level 3 API Key) | 1952284371
personlookup (Level 3 API Key) | 1968996257
persongroups | 1973683411
organizations (Level 3 API Key) | 1971716122
organizationgroups | 1974370301
businessunits | 1946812488
products | 1946812424
productgroups | 1946812422
productlabels | 1947762452
prices | 1967063537
activities | 1946812419
groupactivitybookings | 1946812416
groupActivityInstructors | 1976237797
events | 1946812425
events (Level 3 API Key) | 1973223270
eventbookings | 1946812426
eventbookings (Level 3 API Key) | 1971715989
Participants | 1973682780
servicebookings | 1948319595
resources | 1946976006
resourcetypes | 1947762459
scheduledtimes | 1972305789
bookingtimesuggestions | 1968602812
timeslotsuggestions (deprecated) | 1946976036
subscriptions | 1946812631
orders | 1946812785
orders (Level 3 API Key) | 1960116282
items | 1947434812
receipts | 1946812861
invoices | 1946812849
Valuecards | 1950514889
NoShow | 1963196373
workouts | 1947762465
workouts (Level 3 API Key) | 1960116209
messages | 1946812476
cardreaders | 1957363427
passagetries | 1958018824
documentdata | 1957363409
signatures | 1967620060
owndefinedparameters | 1960541931
paymentcertificates | 1969291065
autogiromedgivanden | 1962770268
avtalegiros | 1950744300
generateregisteravtalegirolink | 1972305731
generateapi3token | 1975156612
finvoice | 5148311553

### DOC space (staff manual)

BRP Systems Documentation (English) | 4787012256
Navigating BRP modules | 4864016437
BRP Back Office - Introduction | 4788650079
BRP Resource Planner - Introduction | 4788650111
BRP Point of Sale - Introduction | 4789043228
BRP Entrance View - Introduction | 4788813875
BRP Configuration - Introduction | 4789076003
Access and Login | 4788682824
Roles | 4788781158
Overview of Person Card | 4793892907
Advanced Selection | 4852514883
Company | 4852645979
Facilities | 4852973605
Products | 4954587198
General Settings for Products | 4807360531
Product Properties | 4807131169
Product Groups | 4802478082
Product Labels | 4802084894
Subscription Product | 4806836651
Subscriptions List | 4809457668
Entry Product | 4807393282
Value Card Product | 4807295005
Value Card for Organization | 4807393334
Value card for Facility Access | 4807262302
Service Product | 4808147028
Class Product | 4808572952
Event Product | 4808572963
Package Product | 4808179835
Item Product | 4930043973
Stock Item Product | 4936335517
Stock locations | 4937744404
Types of transactions | 4937744428
Price | 4807163944
Price Lists | 4802805800
Booking Rules and Cancellation Policies | 4802478102
Booking Rights | 4802805780
Resources | 4800479298
Resource Types | 4852744284
Resource Labels | 4852973637
Resource capacity for product | 4954456162
Resource booking templates | 4949540887
Capacity Types | 4853039105
Schedules | 4800643075
Schedule deviations | 4872372326
Work Shift in Resource Planner | 4802248720
Views | 4852482167
Classes | 4949573661
Schedule a Class in Resource Planner | 4809293863
Class Manager | 4809293903
Manage participants on a class | 4954521619
My classes | 4954292229
Arrival interval for classes | 4954587246
No-show | 4954488886
Substitute management | 4953997335
Book a Service in Resource Planner | 4809588872
Service Bookings with Capacity in Resource Planner | 4948852932
Simple Sale | 4809031712
Sell Subscription in POS | 4808081492
Ways to Access Cash Register | 4808343683
Create Register Report from Point of Sale | 4874829900
Payment Method | 4852777084
Entry/Exit Control | 4809588858
Sound Settings for Entrance View | 4809588831
Admittance types | 4908580894
Admittance rights | 4908875777
Rights | 4908613677
Staff | 4873191853
Staff and Resources section | 4866670596
Overview of Staff Card | 4870930439
Staff access | 4809490537
Salary | 4928962569
Finance section | 4874076161
Finance - Monthly Procedures | 4863098883
Accounts | 4866473998
Accounting Entry Examples | 4865753590
Accrual Accounting | 4799987890
VAT rates | 4873126288
Dimensions | 4818960395
Unbalanced payments | 4875124745
Invoice Customer Accounts | 4874797123
Clearing Expired Value Cards | 4874895395
Role: Finance and accounting | 4873781295
Message templates | 4937711703
Follow-up point | 4938629470
Marketing activities | 4808278086
Types of marketing activities | 4939251730
GDPR - Functionality | 4809359367
GDPR - Settings | 4809359390
GDPR - Anonymize a Person | 4809490476
Sales per Product | 4808278100
Sales per person | 4954849308
Sales per organization | 4954914852
Level of utilization | 4954619976
Utilization per weekday | 4954816514
Customer types by subscription | 4954816565
Customer types by facility | 4954849393
Age distribution | 4954849290
Attendance support | 4954849417
Workouts | 4954947596
Agreements and integrations | 4860477456

### BM space (GoActive app and Mobility Web)

BRP Mobility Documentation | 3962273986
App and Web - A checklist for getting started | 2382790661
Main configuration | 4004151574
Texts in Mobility | 4004053076
Categories | 4005593184
Explore Page | 4005593089
Explore Screen and Web Categories | 4033511546
Central/Local Content in Mobility | 4759879698
Images - Uploading images for app and web | 4010770433
HTML Content Support in the Mobility Project | 4037640310
Date and Time Localization in the app & web | 4038000671
Premium - Base Features | 4038623276
FAQ | 4004249672
Digital Accessibility | 4021747875
Accessibility Compliance Overview | 5004525646
Tillgänglighetsredogörelse | 4154163209
Supported browsers and devices | 4081090626
Translation Requests & Feedback Guide | 4901765199
Classes | 4000546817
Classes in Mobility App | 4016734221
Classes on Mobility Web | 4114055222
Check-in to classes | 4344643585
Subscriptions in App and Web | 4026073132
My subscriptions | 4081745948
Cancel Subscription & Undo Cancellation | 4232642561
Freeze and Unfreeze Subscription | 4236017708
Direct Link to Specific Hidden Subscriptions on the Web | 4450189357
Limiting Subscription Purchase Only to the New Users | 4093509662
Value Cards in App | 4027580435
Value Cards on Mobility Web | 4107501630
My value cards | 4082237451
Entry Tickets in App | 4612423682
Entry Tickets on Mobility Web | 4129816650
Alternative ticket booking flow | 5616795661
Events on Mobility Web | 4108222465
Services in Mobility App | 4181786625
Services on Mobility Web | 4114481381
Item Sales on Mobility Web | 4114677797
Transactions | 4005298222
Invoices and Purchases | 4108222599
Training History | 4382392383
Add bookings to your calendar | 4344086581
Login Flow in App | 4024926217
Register Flows in App | 4069425153
Onboarding Questions for New Users | 4070047745
Agreements and Consents | 4059824168
Consent Requirements on Products | 4117200913
Personal Data | 4060282958
Profile and Settings Screens on Mobility Mobile App | 4042457197
Upload Profile Image | 4530765854
Account and Security | 4060676134
Payment Details | 4060872731
Stronger Password Policies | 4117757975
Lead forms | 4572348417
Mobile Passage | 4344610817
Bluetooth Entrance | 4180312065
QR Codes | 4393992221
Entrance with both QR and Beacons | 4587421700
Staff Center App | 4305158145
Manage Classes | 4304863252
Manage Services | 4305027077
Manage Substitute Requests | 4392682170
Dashboard in Staff Center | 4691918852
Person control | 4711777129
Google analytics | 4006117666
Use of Google Analytics in Mobility | 4020305946
Google Tag Manager | 4119625791
Instructions how to migrate to Google Analytics 4 | 4254236713
Cookie consents | 5517901830
Internal Tracking Information Collection by BRP | 4125589505
Pay with Smartum in Mobility | 4470145641
Pay with Epassi in Mobility | 4470177796
Go Active! 2.0 | 5182554113
Checklist GoActive! 2 | 5447614497
Book together - Friend management | 5477793801
Book together - Book classes | 5485494279
Book together - Connect entrance tickets | 5595004929
Invite a guest | 5019009116
InBody | 5594873862
TechnoGym Enterprise | 5185634309
Right of Withdrawal | 5621153796
Chat with us | 5865242625
"What's New" - Update Reminder | 5146247173
Loyalty introduction | 4891803724
Loyalty Rollout plan & process | 4871061530
Loyalty General Configuration | 4873682957
Loyalty Base Information | 5044142081
Loyalty Achievements | 5044174868
Loyalty Challenges | 4896391176
Loyalty Levels | 5044043796
Loyalty Rewards | 5044076569
Loyalty Streaks, Other and Notifications | 4890067183
Loyalty Refer a friend | 4890198227
Loyalty - Test the functionality | 4890689615
Loyalty launch checklist and activation | 4889968858
Loyalty program maintenance | 4890624095
Loyalty Statistics | 4890067246
Loyalty FAQ | 4890001660
Loyalty web page template | 4891541658

## Cautions

- Do not promise a feature exists without checking its release tag against the BRP Cloud version Boulders runs.
- Denmark-specific payment is Betalingsservice; Sweden uses autogiro, Norway AvtaleGiro. Several docs are Sweden-first, so check country applicability.
- Some Confluence pages are empty parent/index pages. If a fetch comes back blank, look for child pages rather than assuming the feature is undocumented.
- The full API3 reference is in space DOK22 and is not covered here. Fetch it when doing API3 integration work.
