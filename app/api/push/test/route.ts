import { NextResponse } from "next/server";
import webpush from "web-push";
import { getPushSubscriptions } from "../route";

export async function GET() {
  const subscriptions = await getPushSubscriptions();

  if (subscriptions.length === 0) {
    return NextResponse.json(
      { error: "Aucun abonnement push enregistré" },
      { status: 404 }
    );
  }

  webpush.setVapidDetails(
    "mailto:test@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  let sent = 0;

  try {
    for (const subscription of subscriptions) {
      await webpush.sendNotification(
        subscription as webpush.PushSubscription,
        JSON.stringify({
          title: "Investisseur Perso",
          body: "🎉 Test réussi ! Les notifications push fonctionnent.",
        })
      );

      sent++;
    }

    return NextResponse.json({
      success: true,
      sent,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error("Erreur d'envoi push :", error);

    return NextResponse.json(
      { error: "Impossible d'envoyer la notification" },
      { status: 500 }
    );
  }
}