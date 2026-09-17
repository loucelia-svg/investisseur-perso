import { NextResponse } from "next/server";
import webpush from "web-push";
import { getPushSubscription } from "../push/route";

webpush.setVapidDetails(
  "mailto:loucelia.germond@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST() {
  const subscription = await getPushSubscription();

  if (!subscription) {
    return NextResponse.json(
      { error: "Aucun abonnement enregistré" },
      { status: 404 }
    );
  }

  await webpush.sendNotification(
    subscription,
    JSON.stringify({
      title: "Investisseur Perso",
      body: "Ceci est une notification de test 🎉",
    })
  );

  return NextResponse.json({ success: true });
}
export async function GET() {
  return POST();
}