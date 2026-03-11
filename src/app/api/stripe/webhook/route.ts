import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { constructWebhookEvent } from "@/lib/billing/stripe";
import type Stripe from "stripe";

export const config = { api: { bodyParser: false } };

export async function POST(req: NextRequest) {
  const payload = await req.arrayBuffer();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = await constructWebhookEvent(Buffer.from(payload), signature);
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const practiceId = session.metadata?.practiceId;
      const tier = session.metadata?.tier as "basic" | "professional" | undefined;
      const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;

      if (practiceId && subId) {
        await prisma.practice.update({
          where: { id: practiceId },
          data: {
            stripeSubId: subId,
            ...(tier ? { subscriptionTier: tier } : {}),
          },
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const practiceId = sub.metadata?.practiceId;
      const tier = sub.metadata?.tier as "basic" | "professional" | undefined;
      if (practiceId) {
        // past_due = Stripe is still retrying; keep access during grace period.
        // unpaid / canceled = all retries exhausted; revoke access.
        const isActive =
          sub.status === "active" ||
          sub.status === "trialing" ||
          sub.status === "past_due";

        await prisma.practice.update({
          where: { id: practiceId },
          data: {
            stripeSubId: sub.id,
            ...(tier ? { subscriptionTier: tier } : {}),
            active: isActive,
          },
        });

        // Resolve any existing payment alert when subscription becomes healthy again
        if (sub.status === "active" || sub.status === "trialing") {
          await prisma.complianceAlert.updateMany({
            where: { practiceId, alertType: "payment_failed", resolvedAt: null },
            data: { resolvedAt: new Date() },
          });
        }
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const practiceId = sub.metadata?.practiceId;
      if (practiceId) {
        await prisma.practice.update({
          where: { id: practiceId },
          data: { active: false },
        });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Look up the practice by Stripe customer ID
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      const practice = await prisma.practice.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });
      if (!practice) break;

      const attemptCount = invoice.attempt_count ?? 1;
      const severity = attemptCount >= 3 ? "critical" : "warning";

      // Upsert a single alert per practice (update severity if it escalates)
      await prisma.complianceAlert.upsert({
        where: { practiceId_alertType: { practiceId: practice.id, alertType: "payment_failed" } },
        create: {
          practiceId: practice.id,
          alertType: "payment_failed",
          severity,
          title: "Subscription Payment Failed",
          description: `Payment attempt ${attemptCount} failed. Update your payment method in Billing Settings to avoid losing access.`,
        },
        update: {
          severity,
          description: `Payment attempt ${attemptCount} failed. Update your payment method in Billing Settings to avoid losing access.`,
          resolvedAt: null,
        },
      });
      break;
    }

    default:
      // Unhandled event type — ignore
      break;
  }

  return NextResponse.json({ received: true });
}
