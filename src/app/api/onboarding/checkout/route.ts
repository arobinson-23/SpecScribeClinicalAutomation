import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/client";
import { getStripe, createOrRetrieveCustomer } from "@/lib/billing/stripe";
import { apiOk, apiErr } from "@/types/api";
import { z } from "zod";

const CheckoutSchema = z.object({
  practiceId: z.string().uuid(),
  tier: z.enum(["basic", "professional"]),
  providerCount: z.number().int().min(1).max(500),
});

const PRICE_IDS: Record<"basic" | "professional", string | undefined> = {
  basic: process.env.STRIPE_PRICE_ID_BASIC,
  professional: process.env.STRIPE_PRICE_ID_PROFESSIONAL,
};

export async function POST(req: NextRequest) {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json(apiErr("UNAUTHENTICATED"), { status: 401 });
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    return NextResponse.json(apiErr("NO_EMAIL"), { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { practiceId, tier, providerCount } = parsed.data;

  // Verify the practice belongs to this user
  const practice = await prisma.practice.findFirst({
    where: { id: practiceId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!practice) {
    return NextResponse.json(apiErr("PRACTICE_NOT_FOUND"), { status: 404 });
  }

  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    return NextResponse.json(apiErr("STRIPE_PRICE_NOT_CONFIGURED"), { status: 500 });
  }

  // Create or retrieve Stripe customer
  const customerId = await createOrRetrieveCustomer({
    practiceId,
    email,
    practiceName: practice.name,
    stripeCustomerId: practice.stripeCustomerId ?? undefined,
  });

  // Persist customerId if new
  if (!practice.stripeCustomerId) {
    await prisma.practice.update({
      where: { id: practiceId },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: providerCount }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { practiceId, tier },
    },
    metadata: { practiceId, tier },
    success_url: `${appUrl}/dashboard?setup=complete`,
    cancel_url: `${appUrl}/onboarding`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    customer_update: { address: "auto" },
    currency: "cad",
    automatic_tax: { enabled: true },
  });

  return NextResponse.json(apiOk({ url: session.url }));
}
