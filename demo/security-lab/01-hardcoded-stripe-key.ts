/**
 * Demo fixture — hardcoded production Stripe secret (OWASP A02).
 * Intended to be flagged by Security Reviewer every time.
 */
export const billingConfig = {
  currency: 'usd',
  stripeSecretKey: 'sk_live_xxx',
};

export function chargeCustomer(amountCents: number): string {
  return `charge ${amountCents} with ${billingConfig.stripeSecretKey}`;
}
