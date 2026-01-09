# Backend Bug: Account Creation Allowed with Existing Email When Password Matches

## Issue Summary
When attempting to create a new account with an email that already exists, the API allows the account creation to succeed if the password matches the existing account's password, instead of returning a duplicate email error.

## Expected Behavior
The API should return an error (e.g., `EMAIL_ALREADY_EXISTS` or `EMAIL_ALREADY_EXISTS_NAME`) when attempting to create a customer with an email that already exists, regardless of whether the password matches.

## Actual Behavior
- Account creation succeeds when:
  - Email already exists in the system
  - Password matches the existing account's password
- Success toast is shown to the user
- Account appears to be created successfully

## Impact
- Users can create duplicate accounts if they use the same password
- Confusing UX - users think they created a new account when they should log in instead
- Potential data integrity issues if duplicate customer records are created

## Steps to Reproduce
1. Create an account with email `test@example.com` and password `password123`
2. Log out or use a different session
3. Attempt to create a new account with the same email `test@example.com` and same password `password123`
4. Account creation succeeds instead of showing duplicate email error

## API Endpoint
`POST /api/ver3/customers`

## Error Codes Expected
- `EMAIL_ALREADY_EXISTS` - when email exists
- `EMAIL_ALREADY_EXISTS_NAME` - when email and name match (includes fullName parameter)

## Frontend Detection
The frontend code checks for duplicate email errors in multiple ways:
- Error code: `EMAIL_ALREADY_EXISTS`, `EMAIL_ALREADY_EXISTS_NAME`
- Field errors in `fieldErrors` array
- Error messages containing "already exists", "duplicate", "taken", etc.
- HTTP status codes: 409 Conflict or 400 Bad Request with email mention

However, if the API returns a success response (200/201) instead of an error, the frontend cannot detect this issue.

## Workaround
None - this requires backend fix.

## Priority
**HIGH** - Affects account creation flow and user experience

## Date Reported
2026-01-09

## Status
🔴 **OPEN** - Awaiting backend team investigation
