# Step 4 Testing Checklist

## What to Test

### 1. Reference Data Loading After Business Unit Selection
- [ ] Open the app in your browser
- [ ] Open browser console (F12 or Cmd+Option+I)
- [ ] Select a business unit (gym location)
- [ ] Check console - should see:
  - `[Step 4] Loading reference data for business unit: {id}`
  - `[Step 4] Fetching reference data ({type}) from: ...`
  - `[Step 4] All reference data loaded: {}`
- [ ] Reference data should load automatically (no manual action needed)

### 2. Reference Data Caching
- [ ] After selecting a gym, check browser console
- [ ] Type in console:
  ```javascript
  state.referenceData        // Should show object (may be empty if no endpoints exist)
  state.referenceDataLoaded  // Should show true
  ```
- [ ] Verify data is stored in state

### 3. Reference Data Refresh on Business Unit Change
- [ ] Select first business unit (gym)
- [ ] Check console - note the business unit ID
- [ ] Go back to gym selection (if possible) or refresh page
- [ ] Select a different business unit
- [ ] Check console - should see:
  - Reference data loading again for the new business unit
  - Cache should be cleared and refreshed

### 4. Error Handling (404s)
- [ ] Select a business unit
- [ ] Check console for messages like:
  - `[Step 4] Reference data endpoint {type} not found (404) - may not be implemented yet`
- [ ] App should continue working normally (no crashes)
- [ ] This is expected behavior - reference data endpoints may not exist yet

### 5. State Verification
Open browser console and type:
```javascript
// Check reference data state
state.referenceData         // Should show object (empty {} if no endpoints available)
state.referenceDataLoaded   // Should show true after loading attempt
state.selectedBusinessUnit  // Should show numeric ID
```

## Expected Console Output

When everything works, you should see:
```
[Step 4] Loading reference data for business unit: 1
[Step 4] Fetching reference data (countries) from: ...
[Step 4] Reference data endpoint countries not found (404) - may not be implemented yet
[Step 4] All reference data loaded: {}
[Step 4] Reference data loaded and cached: {}
```

**Note**: The reference data object may be empty `{}` because the endpoints might not be implemented yet. This is **normal and expected**. The important thing is that:
- The loader runs automatically
- It doesn't crash on 404s
- The state is updated correctly

## What's Working vs. What's Not

### ✅ What Should Work:
- Reference data loader runs automatically after gym selection
- Reference data is cached in state
- Cache refreshes when business unit changes
- 404 errors are handled gracefully (no crashes)
- Console logging shows what's happening

### ⚠️ What Might Not Work Yet:
- Actual reference data endpoints may not exist yet (404s are expected)
- Reference data object may be empty `{}` - this is OK!
- The loader is ready, but needs endpoints to be implemented on the backend

## Testing Checklist Summary

- [ ] Reference data loader runs after gym selection
- [ ] Console shows `[Step 4]` log messages
- [ ] `state.referenceData` exists and is an object
- [ ] `state.referenceDataLoaded` is `true` after selection
- [ ] App doesn't crash if endpoints return 404
- [ ] Reference data refreshes when switching gyms

## Common Issues to Check

1. **No console messages** → Check if `loadReferenceData()` is being called
2. **App crashes on 404** → Error handling might need adjustment
3. **Reference data not refreshing** → Check if cache is being cleared on gym change
4. **State not updating** → Check browser console for JavaScript errors

## What to Report

If something doesn't work, please share:
1. Browser console errors/warnings
2. What you see in console when selecting a gym
3. The value of `state.referenceData` and `state.referenceDataLoaded`
4. Any error messages

## Quick Test Commands

Paste these in browser console after selecting a gym:

```javascript
// Check if reference data was loaded
console.log('Reference Data:', state.referenceData);
console.log('Loaded?', state.referenceDataLoaded);
console.log('Business Unit:', state.selectedBusinessUnit);

// Check if ReferenceDataAPI exists
console.log('ReferenceDataAPI exists?', typeof referenceDataAPI !== 'undefined');
```

