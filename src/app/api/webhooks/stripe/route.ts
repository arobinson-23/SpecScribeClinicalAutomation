import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { constructWebhookEvent } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db/client";
import { logger } from "@/lib/utils/logger";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = Buffer.from(await req.arrayBuffer());

  let event;
  try {
    event = await constructWebhookEvent(payload, signature);
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", { error: String(err) });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logger.info("Stripe webhook received", { type: event.type });

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as { customer: string; id: string; status: string; items?: { data?: Array<{ price?: { id?: string } }> } };
      const customerId = sub.customer;

      await prisma.practice.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          stripeSubId: sub.id,
          subscriptionTier:
            sub.status === "active"
              ? (sub.items?.data?.[0]?.price?.id === process.env.STRIPE_PRICE_ID_ENTERPRISE
                ? "enterprise"
                : sub.items?.data?.[0]?.price?.id === process.env.STRIPE_PRICE_ID_PROFESSIONAL
                ? "professional"
                : "basic")
              : "basic",
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as { customer: string };
      await prisma.practice.updateMany({
        where: { stripeCustomerId: sub.customer },
        data: { stripeSubId: null, subscriptionTier: "basic" },
      });
      break;
    }

    default:
      logger.info("Unhandled Stripe event type", { type: event.type });
  }

  return NextResponse.json({ received: true });
}
