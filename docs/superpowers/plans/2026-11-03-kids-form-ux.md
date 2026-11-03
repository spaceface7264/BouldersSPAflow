# Kids form UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the child block above the parent account on Junior signup, and make age, name, existing children, and field errors obvious.

**Architecture:** Pure age and possessive helpers live in `utils/memberCopy.js`. `app.js` places `#parentGuardianForm`, writes the copy, and validates the same fields the order already requires. The child is still created only inside `ensureMemberCustomer`.

**Tech Stack:** Vanilla `app.js`, `index.html`, `styles.css`, `node --test`.

## Global Constraints

- Live signup only. Do not edit `features/` or `src/`.
- `#parentGuardianForm` stays outside the parent `<form>`.
- Fields do not change. Under 16: name, date of birth, guardian consent. Handoff adds the young person's own email.
- One order, one member. Punch cards and `/99kr` never show this block.
- Copy is Danish, English, and German.
- HTML text nodes are set with `textContent`. No `innerHTML` for member names.

### Task 1: memberCopy

**Files:**
- Create: `utils/memberCopy.js`
- Test: `utils/memberCopy.test.js`

- [ ] Write `utils/memberCopy.test.js` for `memberAgeStatus` and `possessive`.
- [ ] Run `node --test utils/memberCopy.test.js` and confirm it fails because the module is missing.
- [ ] Add `memberAgeStatus(age, mode)` and `possessive(name, language)` per the spec.
- [ ] Re-run the test and confirm it passes.

### Task 2: Markup and styles

**Files:**
- Modify: `index.html` (`#buyerRole` step, `#parentGuardianForm`)
- Modify: `styles.css` (`.parent-guardian-form`, `.existing-member-option`, age line, summary)

- [ ] Add `#buyerRoleStep`, `#memberFormTitle`, `#memberFormHint`, `#memberSummary`, `#memberAgeStatus`, and `.error-message` nodes. Mark heading, hint, consent, and summary with `data-member-copy`.
- [ ] Stop the resting slide animation. Play `.is-revealed` once. Honor `prefers-reduced-motion`.
- [ ] Style selected children and the add button as 44px rows. Selected state uses `#F401F5`.

### Task 3: Signup behavior

**Files:**
- Modify: `app.js`

- [ ] Import the helpers. Add the copy keys, including `form.member.ageShort`.
- [ ] Place the member block before the create section only when both are visible.
- [ ] Keep the save button in the parent form while the create section is visible. Move it only for a logged-in parent, and stop forcing `.valid`.
- [ ] Render existing children with name and age. Hide empty fields until "add another" unless a draft value is already present.
- [ ] Collapse the 16–17 handoff to a summary with Ret.
- [ ] `refreshMemberCopy` owns heading, hint, consent, summary, step numbers, and the logged-in button label. Call it at the end of `updatePageTranslations`. Skip `[data-member-copy]` in the generic pass.
- [ ] `validateMemberFields` feeds `handleSaveAccount`, `handleSaveMember`, and `validateForm`.

### Task 4: Verify

- [ ] `node --test utils/memberCopy.test.js`
- [ ] In the browser, with Junior selected, confirm the child block is above the parent account and the age line updates.
