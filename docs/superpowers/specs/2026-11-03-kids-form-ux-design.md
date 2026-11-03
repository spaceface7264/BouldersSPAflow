# Kids form UX

**Status:** Approved in conversation on 2026-11-03. Screen sequence, polish, and the 16–17 handoff treatment are decided.

**Goal:** On a Junior signup, ask who the membership is for before the parent fills an account, and make the child block confirm age, name the child, and show errors on the field that failed.

**Surface:** The live signup only. `index.html`, `app.js`, `styles.css`, plus a small pure helper. Do not edit `features/` or `src/`.

## Decisions

- One screen. No extra checkout step.
- `#parentGuardianForm` stays outside the parent `<form class="registration-form">`. It is never nested in another form.
- The fields collected do not change. Under 16: first name, last name, date of birth, guardian consent. At 16–17 in the guardian handoff: those, plus the young person's own email.
- The child is still created with the existing `createOtherUser` call inside `ensureMemberCustomer`, after a paying customer id exists. This design validates earlier. It does not create the child earlier.
- One order, one member. Punch cards and `/99kr` never show this block.
- Copy is Danish, English, and German, beside the existing `form.member.*` keys.

## Placement

`updateMemberFormVisibility` already runs on auth-mode switch. Extend it.

Anchor: `.info-form-section`. Reference node: `[data-auth-section="create"]`.

| Situation | Where `#parentGuardianForm` sits |
| --- | --- |
| Member block visible and the create-account section is visible | Before the create-account section |
| Anything else | After the create-account section, which is where the markup ships |

When the create section is `display: none` (logged in, or login mode), "after the create section" is visually straight under the login block, because a hidden section takes no space. Logged-in parents keep seeing only the child block.

Moving the node restarts the CSS `slideDown` on `.parent-guardian-form`. Remove the animation from the resting rule. Play it once, when the block goes from hidden to shown. Under `prefers-reduced-motion: reduce`, keep the placement and drop the slide. A short opacity change is enough.

## Three states

### New Junior account

Create-account is visible, `guardianHandoffActive` is false.

1. Child block. Step badge `1`. Heading starts as the question below. Fields: first name, last name, date of birth, consent.
2. Parent block. Step badge `2`. Heading stays "Forælder eller værge" / "Parent or guardian" / "Elternteil oder Vormund". Account fields stay as they are.
3. `#saveAccountButton` stays inside `#saveAccountActions` in the parent form. Label stays "Opret profil". `placeJuniorFormSubmit` must not move it into `#juniorFormActions` while the create section is visible.

`handleSaveAccount` checks the child fields before `blockMembershipAgeGate('saveAccount')` and before any profile create, when the member block is visible and `state.pickedMemberId` is null. Invalid child fields stop the save. The first invalid field scrolls into view with `block: 'nearest'`.

`checkSaveAccountButtonState` adds `.valid` on that button only when the parent fields pass and the child fields pass. A picked existing member counts as the child side passing.

### Logged-in parent

Create-account stays hidden. The child block hides its step badge. The button moves into `#juniorFormActions`, as it does today for that case. Action stays `save-member`.

Existing children from `loadExistingMembers`:

- Each person is a `<button type="button">` with `aria-pressed`. Two text nodes via `textContent` on child elements: the full name, and the age when `birthDate` parses. No `innerHTML`.
- `state.pickedMemberFirstName` is set in `pickExistingMember` and cleared in `addAnotherMember`.
- The selected button uses a magenta border (`#F401F5`) and a faint magenta fill. Minimum height 44px.
- "Tilføj et andet barn" is the same kind of button, always visible when the list has at least one person. It is not an underline link.
- When the list has people, nothing is picked, and first name, last name, date of birth, and email are all empty, `#memberNewFields` stays hidden. Opening "add another" shows the fields, clears the pick, and focuses `#memberFirstName`.
- When the list is empty, the fields are open and the add button is hidden.
- If a field already has a value when the list arrives, leave the fields open.

Button label: `form.member.continueWith` once a first name is known (typed, or `state.pickedMemberFirstName`). Until then, `form.member.save` ("Gem"). `refreshMemberCopy` writes the label itself, including the `{name}` substitution, because it runs after the generic translation pass. The logged-in button takes `.valid` only when a child is picked or `validateMemberFields()` passes. `setMemberSaveButton` must stop forcing `.valid` on every show.

### 16–17 guardian handoff

`beginGuardianHandoff` still copies the typed youth details into the member fields and clears the buyer fields. The guardian account remains the thing they fill.

The member block moves above the create section and collapses:

- Profile heading is the young person's first name, or "Den unge" when the first name is empty.
- Hint is the age line when the date parses.
- `#memberSummary` shows the email and a "Ret" button (`data-action="edit-handoff-member"`). `#memberNewFields` is hidden.
- "Ret" sets `state.editingHandoffMember`, hides the summary, shows the fields, and focuses the first name.
- `beginGuardianHandoff` sets `editingHandoffMember` to false.
- Both step badges are hidden. The buyer heading stays "Værge".
- The save button stays in the guardian form. Same rule as a new account: do not move it while the create section is visible. Child fields must be valid before the guardian profile is created. They already contain the copied youth details.

## Age line

New node `#memberAgeStatus` under `#memberDateOfBirth`, `aria-live="polite"`. Update on `input` and `change`.

Pure helper `memberAgeStatus(age, mode)` in `utils/memberCopy.js`:

| mode | age | result |
| --- | --- | --- |
| either | `null` | `empty` |
| either | `< 0` | `invalid` |
| `junior` | `0`–`15` | `junior-ok` |
| `junior` | `>= 16` | `junior-bad` |
| `guardian` | `16` or `17` | `youth-ok` |
| `guardian` | anything else numeric | `youth-bad` |

`empty` hides the line. `invalid` shows `form.member.error.birthDate` and uses the bad color. Do not print a negative age. `junior-ok` and `youth-ok` use the ok color. `junior-bad` shows `form.member.ageJuniorBad`. `youth-bad` shows `form.member.ageYouthBad`. Both use the bad color. The line is status while typing. On submit, the date field's error uses that same string.

Age comes from `ageInYears` in `utils/registrationIdentity.js` and `getTodayLocalDateString()`.

## Name and consent

`refreshMemberCopy()` owns the member heading, the member hint, the consent sentence, the handoff summary, the logged-in button label, and the step-badge numbers. Call it at the end of `updatePageTranslations`, and from the member first-name listener.

`updatePageTranslations` skips elements with `data-member-copy` (heading, hint, consent span, summary). A language switch cannot wipe a typed name on the way through the generic pass.

Heading: the trimmed first name when it is non-empty. Otherwise `form.member.title`, or `form.member.youthTitle` during handoff.

Hint: during handoff, the age line when the date parses, otherwise `form.member.youthHint`. Outside handoff, a named heading uses `form.member.productJunior`. A heading that is still the question uses `form.member.roleHint`.

Consent: when the first name is empty, the existing `form.member.consent`. When it is present, `form.member.consentNamed`, with `{possessive}` and `{name}` filled by `possessive(name, language)` in `utils/memberCopy.js`.

`possessive`:

- Empty name returns `''`.
- English: a name ending in `s` or `S` gets a trailing apostrophe. Any other name gets `'s`.
- Danish and German: a name ending in `s`, `S`, `x`, `X`, `z`, or `Z` gets a trailing apostrophe. Any other name gets `s`.

The consent node is a text span. Setting its text is safe. Do not build it with HTML.

## Errors

Use the existing `.form-group.error` / `.error-message` pattern from the parent form. Add an `.error-message` node for `#memberFirstName`, `#memberLastName`, `#memberDateOfBirth`, `#memberEmail`, and `#memberGuardianConsent`.

One function, `validateMemberFields()`, used by:

- `handleSaveAccount`, when the member block is visible and no existing member is picked
- `handleSaveMember`
- `validateForm` (checkout), replacing the consent-only check around the `Missing guardian consent` branch

It reads input values. A handoff summary may hide the fields; the copied values still count. A picked existing member skips this check.

It returns `{ ok, errors }` keyed by field id. Each message:

| Field | When | Key |
| --- | --- | --- |
| `memberFirstName` | empty | `form.member.error.firstName` |
| `memberLastName` | empty | `form.member.error.lastName` |
| `memberDateOfBirth` | empty, unparseable, or future | `form.member.error.birthDate` |
| `memberDateOfBirth` | junior and age 16+ | `form.member.ageJuniorBad` |
| `memberDateOfBirth` | guardian and age outside 16–17 | `form.member.ageYouthBad` |
| `memberEmail` | guardian and empty | `form.member.emailRequired` |
| `memberEmail` | present and equal to the payer email | `form.member.emailOwn` or `form.member.ownEmail` for junior, matching `ensureMemberCustomer` today |
| `memberGuardianConsent` | unchecked | `form.member.error.consent` |

On failure: mark each field, set `aria-invalid="true"` and `aria-describedby` to that error node, toast the first message, scroll the first invalid field into view. `clearErrorStates` also clears these member fields. An `input` or `change` on a member field clears that field's error when the value now passes.

`ensureMemberCustomer` still refuses to create on the same rules. Its toast remains the backup for failures that happen at order time (`form.member.createFailed`, age codes from the API, missing customer type).

## Copy

Danish is the source. English and German ship in the same change.

| Key | da-DK | en-GB | de |
| --- | --- | --- | --- |
| `form.member.title` | Hvem er medlemskabet til? | Who is this membership for? | Für wen ist die Mitgliedschaft? |
| `form.member.roleHint` | Medlemskabet gælder barnet. | The membership is for the child. | Die Mitgliedschaft gilt für das Kind. |
| `form.member.youthHint` | Medlemskabet gælder den unge. | The membership is for the young person. | Die Mitgliedschaft gilt für die junge Person. |
| `form.member.productJunior` | Junior | Junior | Junior |
| `form.member.productYouth` | Ungdom | Youth | Jugend |
| `form.member.consentNamed` | Jeg er {possessive} værge og køber medlemskabet for {name}. | I am {possessive} guardian and I am buying this membership for {name}. | Ich bin {possessive} Vormund und kaufe die Mitgliedschaft für {name}. |
| `form.member.continueWith` | Fortsæt med {name} | Continue with {name} | Weiter mit {name} |
| `form.member.ageShort` | {age} år | {age} years | {age} Jahre |
| `form.member.ageJuniorOk` | {age} år. Junior passer. | {age} years. Junior fits. | {age} Jahre. Junior passt. |
| `form.member.ageJuniorBad` | {age} år. Junior er til børn under 16. | {age} years. Junior is for children under 16. | {age} Jahre. Junior ist für Kinder unter 16. |
| `form.member.ageYouthOk` | {age} år. Ungdomsmedlemskabet passer. | {age} years. The youth membership fits. | {age} Jahre. Die Jugendmitgliedschaft passt. |
| `form.member.ageYouthBad` | {age} år. Kun 16 eller 17 år. | {age} years. Only 16 or 17. | {age} Jahre. Nur 16 oder 17. |
| `form.member.error.firstName` | Indtast fornavn. | Enter a first name. | Gib den Vornamen ein. |
| `form.member.error.lastName` | Indtast efternavn. | Enter a last name. | Gib den Nachnamen ein. |
| `form.member.error.birthDate` | Angiv en gyldig fødselsdato. | Enter a valid date of birth. | Gib ein gültiges Geburtsdatum an. |
| `form.member.error.consent` | Bekræft, at du er værge. | Confirm that you are the guardian. | Bestätige, dass du Vormund bist. |
| `form.member.edit` | Ret | Edit | Bearbeiten |

Existing keys that stay: `form.member.consent` (no name yet), `form.member.youthTitle`, `form.member.under16`, `form.member.youthAge`, `form.member.emailRequired`, `form.member.emailOwn`, `form.member.ownEmail`, `form.member.save`, `form.member.addAnother`. `ensureMemberCustomer` can keep using `under16` and `youthAge` for a toast if validation was bypassed. The form itself shows the age-line sentence.

## Out of scope

- New member fields (phone, address).
- Changing `createOtherUser`, customer-type resolution, or age routing in `membershipAgeRoute`.
- A second member on the same order.
- The React signup scaffold.

## Tests

`node --test utils/memberCopy.test.js` covers `memberAgeStatus` and `possessive`, including Emma, Jonas, Max, a future date's negative age, and a null date.

Browser, on the running signup, Junior selected:

- New account: child block is above the parent account, step badges read 1 then 2, and "Opret profil" stays under the parent fields. Submit with an empty child block marks the child fields and does not create a profile.
- A date under 16 shows the ok age line. A date of 16 or older shows the bad line and blocks submit.
- Typing a first name replaces the heading and the consent line. A language switch keeps the name.
- Logged in with children already on the account: those children show name and age, the empty fields stay closed, and "add another" opens them. The button reads "Fortsæt med {name}" for a picked child.
- Logged in with no children: the fields are open.
- Guardian handoff: the youth summary is above the empty guardian form, "Ret" expands the fields, and the save button stays on the guardian form.
- An adult membership, a punch card, and `/99kr` do not show the block.
- Keyboard: the person buttons and "Ret" are real buttons, errors are tied to the fields with `aria-invalid` and `aria-describedby`, and the age line is a polite live region.
