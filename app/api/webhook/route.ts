import Stripe from "stripe";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { stripe } from "@/lib/stripe";
import prismadb from "@/lib/prismadb";

export const runtime = "nodejs";

function getSubscriptionIdFromInvoice(
  invoice: Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  }
): string | null {
  const sub = invoice.subscription;
  if (!sub) return null;
  if (typeof sub === "string") return sub;
  return sub.id ?? null;
}

export async function POST(req: Request) {
  const body = await req.text();

  const h = await headers();
  const signature = h.get("stripe-signature");
  if (!signature) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new NextResponse("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return new NextResponse("Webhook signature verification failed", {
      status: 400,
    });
  }

  try {
    switch (event.type) {
      /** ✅ FIRST PAYMENT */
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        console.log("[WEBHOOK] type", event.type);
        console.log("[WEBHOOK] metadata.userId", session?.metadata?.userId);
        console.log("[WEBHOOK] session.subscription", session?.subscription);

        const userId = session?.metadata?.userId;
        if (!userId) {
          return new NextResponse("User id is required", { status: 400 });
        }

        const stripeSubscriptionId =
          typeof session.subscription === "string" ? session.subscription : null;

        if (!stripeSubscriptionId) {
          return new NextResponse("Subscription id is required", { status: 400 });
        }

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        const item = subscription.items?.data?.[0];
        const stripePriceId = item?.price?.id ?? null;

        const cpe = item?.current_period_end;
        if (!cpe) {
          return new NextResponse("Missing current_period_end on subscription item", {
            status: 400,
          });
        }

        const stripeCurrentPeriodEnd = new Date(cpe * 1000);

        try {
          const existing = await prismadb.userSubscription.findFirst({
            where: { userId },
            orderBy: { stripeCurrentPeriodEnd: "desc" },
          });

          if (existing) {
            await prismadb.userSubscription.update({
              where: { id: existing.id },
              data: {
                stripeCustomerId: String(subscription.customer),
                stripeSubscriptionId,
                stripePriceId,
                stripeCurrentPeriodEnd,
              },
            });
          } else {
            await prismadb.userSubscription.create({
              data: {
                userId,
                stripeCustomerId: String(subscription.customer),
                stripeSubscriptionId,
                stripePriceId,
                stripeCurrentPeriodEnd,
              },
            });
          }

          const rows = await prismadb.userSubscription.findMany({
            where: { userId },
          });
          console.log("[WEBHOOK] rows after write", rows.length);
        } catch (e) {
          console.error("[WEBHOOK] write failed", e);
          return new NextResponse("Webhook DB write failed", { status: 500 });
        }

        break;
      }

      /** 🔁 RENEWALS */
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };

        const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);
        if (!stripeSubscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

        const item = subscription.items?.data?.[0];
        const stripePriceId = item?.price?.id ?? null;

        const cpe = item?.current_period_end;
        if (!cpe) break;

        const stripeCurrentPeriodEnd = new Date(cpe * 1000);

        await prismadb.userSubscription.updateMany({
          where: { stripeSubscriptionId },
          data: {
            stripeCustomerId: String(subscription.customer),
            stripePriceId,
            stripeCurrentPeriodEnd,
          },
        });

        break;
      }

      /** ❌ CANCELLATIONS */
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await prismadb.userSubscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            stripeSubscriptionId: null,
            stripePriceId: null,
            stripeCurrentPeriodEnd: null,
          },
        });

        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch {
    return new NextResponse("Webhook handler failed", { status: 500 });
  }
}
