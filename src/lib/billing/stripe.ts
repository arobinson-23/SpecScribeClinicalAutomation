import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

export async function createOrRetrieveCustomer(params: {
  practiceId: string;
  email: string;
  practiceName: string;
  stripeCustomerId?: string;
}): Promise<string> {
  const stripe = getStripe();

  if (params.stripeCustomerId) {
    return params.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: params.email,
    name: params.practiceName,
    metadata: { practiceId: params.practiceId },
  });

  return customer.id;
}

export async function createSubscription(params: {
  customerId: string;
  priceId: string;
  quantity: number; // number of providers
  trialDays?: number;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  return stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId, quantity: params.quantity }],
    trial_period_days: params.trialDays,
    payment_behavior: "default_incomplete",
    currency: "cad",
    expand: ["latest_invoice.payment_intent"],
  });
}

export async function createBillingPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });

  return session.url;
}

export async function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
