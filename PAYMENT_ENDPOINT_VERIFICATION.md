# Payment Link Endpoint Verification

## Current Implementation

### Endpoint
- **URL**: `POST https://api-join.boulders.dk/api/payment/generate-link`
- **Method**: `POST`
- **Documentation**: https://documenter.getpostman.com/view/6552350/2sB3Wtsz3V#75d4fd2c-d336-43a3-a48f-5808f04290ad

### Headers
```javascript
{
  'Accept-Language': 'da-DK',
  'Content-Type': 'application/json',
  'Authorization': 'Bearer {accessToken}'  // Conditional - only if token exists
}
```

### Payload
```javascript
{
  orderId: number,           // Required: Order ID (numeric)
  paymentMethodId: number,    // Required: Payment method ID (1=card, 2=debit, 3=mobilepay)
  businessUnit: number,      // Required: Business unit ID (numeric, converted from string if needed)
  returnUrl: string          // Required: Absolute URL to return to after payment
}
```

### Response Handling
- Checks for: `data.url`, `data.data?.url`, `data.data?.paymentLink`, `data.data?.link`, `data.paymentLink`, `data.link`
- Returns payment link URL

## Verification Checklist

Please verify against Postman documentation:

### Endpoint
- [ ] URL is correct: `https://api-join.boulders.dk/api/payment/generate-link`
- [ ] HTTP Method is correct: `POST`

### Headers
- [ ] `Accept-Language: da-DK` is required/correct
- [ ] `Content-Type: application/json` is required/correct
- [ ] `Authorization: Bearer {token}` format is correct
- [ ] All required headers are included
- [ ] No extra headers that shouldn't be there

### Payload Fields
- [ ] `orderId` field name is correct (case-sensitive)
- [ ] `orderId` type is correct (number/integer)
- [ ] `paymentMethodId` field name is correct (case-sensitive)
- [ ] `paymentMethodId` type is correct (number/integer)
- [ ] `businessUnit` field name is correct (case-sensitive)
- [ ] `businessUnit` type is correct (number/integer)
- [ ] `returnUrl` field name is correct (case-sensitive)
- [ ] `returnUrl` type is correct (string)
- [ ] All required fields are included
- [ ] No extra fields that shouldn't be there

### Response
- [ ] Response structure matches documentation
- [ ] Payment link extraction logic is correct
- [ ] Error handling is appropriate

## Potential Issues to Check

1. **Field names**: Are they exactly as documented? (case-sensitive)
2. **Field types**: Are numbers actually numbers, not strings?
3. **Required vs Optional**: Are all required fields included?
4. **Response structure**: Does the response match what we're expecting?

## If Something Doesn't Match

Please provide:
1. What field/structure doesn't match
2. What the documentation says it should be
3. What we're currently sending/receiving

