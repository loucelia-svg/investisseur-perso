import { NextResponse } from "next/server";
import webpush from "web-push";
import { getPushSubscriptions } from "../push/route";

webpush.setVapidDetails(
  "mailto:loucelia.germond@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST() {
  const subscriptions = await getPushSubscriptions();

  if (subscriptions.length === 0) {
    return NextResponse.json(
      { error: "Aucun abonnement enregistré" },
      { status: 404 }
    );
  }

  let sent = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({
          title: "Investisseur Perso",
          body: "Ceci est une notification de test 🎉",
        })
      );

      sent++;
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi de la notification :",
        error
      );
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    total: subscriptions.length,
  });
}

export async function GET() {
  return POST();
}