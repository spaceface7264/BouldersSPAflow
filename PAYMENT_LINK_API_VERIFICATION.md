# Payment Link API Implementation Verification

## Current Implementation

### Endpoint
- **URL**: `POST https://api-join.boulders.dk/api/payment/generate-link`
- **Documentation**: https://documenter.getpostman.com/view/6552350/2sB3Wtsz3V#75d4fd2c-d336-43a3-a48f-5808f04290ad

### Headers
```javascript
{
  'Accept-Language': 'da-DK',
  'Content-Type': 'application/json',
  'Authorization': 'Bearer {accessToken}'  // Required if authenticated
}
```

### Payload
```javascript
{
  orderId: number,           // Required: Order ID
  paymentMethodId: number,   // Required: Payment method ID (1=card, 2=debit, 3=mobilepay)
  businessUnit: string,     // Required: Business unit ID
  returnUrl: string         // Required: Absolute URL to return to after payment
}
```

### Response Handling
- Checks for `data.url` or `data.data?.url` or `data.paymentLink` or `data.link`
- Returns payment link URL

## Verification Checklist

Please verify against Postman documentation:

- [ ] Endpoint URL is correct
- [ ] HTTP Method (POST) is correct
- [ ] All required headers are included
- [ ] All required payload fields are included
- [ ] Payload field names match exactly (case-sensitive)
- [ ] Payload field types match (orderId: number, paymentMethodId: number, etc.)
- [ ] Response structure handling is correct
- [ ] Authentication token format is correct (Bearer token)

## Potential Issues

1. **businessUnit type**: Currently sending as string, but might need to be number
2. **paymentMethodId mapping**: Currently mapping "card" -> 1, "debit" -> 2, "mobilepay" -> 3
3. **returnUrl format**: Must be absolute URL (currently using `window.location.origin + window.location.pathname + ?payment=return&orderId={orderId}`)

