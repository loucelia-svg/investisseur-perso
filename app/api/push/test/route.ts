import { NextResponse } from "next/server";
import webpush from "web-push";
import { getPushSubscriptions } from "../route";
import { supabase } from "@/lib/supabase";

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
  let removed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        subscription as webpush.PushSubscription,
        JSON.stringify({
          title: "Investisseur Perso",
          body: "🎉 Test réussi ! Les notifications push fonctionnent.",
        })
      );

      sent++;
    } catch (error: any) {
      console.error("Erreur d'envoi push :", error);

      if (error.statusCode === 410) {
        const { error: deleteError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);

        if (deleteError) {
          console.error(
            "Erreur lors de la suppression de l'abonnement :",
            deleteError
          );
        } else {
          removed++;
          console.log("Abonnement push expiré supprimé de Supabase.");
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    removed,
    total: subscriptions.length,
  });
}