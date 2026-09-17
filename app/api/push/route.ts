import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const subscriptionFile = path.join(
  process.cwd(),
  "push-subscription.json"
);

export async function POST(request: Request) {
  try {
    const subscription = await request.json();

    await fs.writeFile(
      subscriptionFile,
      JSON.stringify(subscription, null, 2),
      "utf8"
    );

    console.log("Abonnement push enregistré.");

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
    const data = await fs.readFile(subscriptionFile, "utf8");

    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json(
      { error: "Aucun abonnement push enregistré" },
      { status: 404 }
    );
  }
}

export async function getPushSubscription() {
  try {
    const data = await fs.readFile(subscriptionFile, "utf8");

    return JSON.parse(data);
  } catch {
    return null;
  }
}