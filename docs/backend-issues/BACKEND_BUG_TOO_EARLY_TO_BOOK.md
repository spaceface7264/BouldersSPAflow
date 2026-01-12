# Backend Bug: TOO_EARLY_TO_BOOK error when booking should already be open

## Problem
API is returning `TOO_EARLY_TO_BOOK` for classes that should already be bookable. The `earliestTimepoint` says booking opens in 2+ days, but it should be open now.

## Symptoms
- User tries to book a class
- API returns `403 Forbidden` with `TOO_EARLY_TO_BOOK`
- `earliestTimepoint` in the error is 2+ days in the future
- Booking should be available based on the class schedule

## Evidence from logs
```
[Classes] Book group activity error (403): {"errorCode":"TOO_EARLY_TO_BOOK","earliestTimepoint":"2026-01-14T23:00:00.000Z"}

[Classes] TOO_EARLY_TO_BOOK error details: {
  earliestTimepoint: '2026-01-14T23:00:00.000Z',
  earliestDate: '2026-01-14T23:00:00.000Z',
  currentTime: '2026-01-12T22:03:46.237Z',
  timeUntilBooking: '2936 minutes',
  shouldBeOpen: false,
  timezoneOffset: -60
}
```

**Timeline:**
- Current time: `2026-01-12T22:03:46.237Z` (January 12, 2026 at 22:03 UTC)
- Earliest booking time: `2026-01-14T23:00:00.000Z` (January 14, 2026 at 23:00 UTC)
- Time until booking opens: ~48 hours (2 days)

## Expected Behavior
Booking should be open when the class is within the booking window. `bookableEarliest` should match when booking actually opens, not be set to some future date.

## Actual Behavior
API says booking opens in 2+ days when it should be open now. Users can't book classes that should be available.

## Impact
- Users cannot book classes that should be available
- Poor user experience with confusing error messages
- Potential loss of bookings if users give up trying

## Possible Causes
1. `bookableEarliest` is set wrong in the group activity config
2. Timezone calculation is off (API using different timezone than expected)
3. Booking window logic is broken
4. Database/config has wrong `earliestTimepoint` value

## Requested Fix
1. Check `bookableEarliest` calculation logic
2. Make sure booking windows are set correctly
3. Verify timezone handling is consistent
4. Confirm `earliestTimepoint` in error response matches the actual booking window

## Workaround
Frontend shows a better error message with when booking opens, but users still can't book until the API allows it.

## Test Cases
1. Try booking a class that should be within the booking window
2. Check if `earliestTimepoint` in error matches expected booking window
3. Verify booking works when `earliestTimepoint` is in the past
4. Make sure timezone handling is consistent between API and frontend
