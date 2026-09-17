import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const subscription = await request.json();

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          endpoint: subscription.endpoint,
          subscription,
        },
        {
          onConflict: "endpoint",
        }
      );

    if (error) {
      console.error("Erreur Supabase :", error);

      return NextResponse.json(
        { error: "Impossible d'enregistrer l'abonnement" },
        { status: 500 }
      );
    }

    console.log("Abonnement push enregistré dans Supabase.");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de l'enregistrement :", error);

    return NextResponse.json(
      { error: "Impossible d'enregistrer l'abonnement" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (error) {
      console.error("Erreur Supabase :", error);

      return NextResponse.json(
        { error: "Impossible de récupérer les abonnements" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur lors de la récupération :", error);

    return NextResponse.json(
      { error: "Impossible de récupérer les abonnements" },
      { status: 500 }
    );
  }
}

export async function getPushSubscriptions() {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("subscription");

  if (error) {
    console.error("Erreur Supabase :", error);
    return [];
  }

  return data.map((row) => row.subscription);
}