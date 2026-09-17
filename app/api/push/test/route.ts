import { NextResponse } from "next/server";
import webpush from "web-push";
import { getPushSubscription } from "../route";

export async function GET() {
  const subscription = await getPushSubscription();

  if (!subscription) {
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

  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify({
        title: "Investisseur Perso",
        body: "🎉 Test réussi ! Les notifications push fonctionnent.",
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur d'envoi push :", error);

    return NextResponse.json(
      { error: "Impossible d'envoyer la notification" },
      { status: 500 }
    );
  }
}