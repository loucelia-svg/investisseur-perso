import { NextResponse } from "next/server";
import { getHistoricalFundamentalsForCharts } from "@/lib/fundamentals";

export async function GET() {
  try {
    const data =
      await getHistoricalFundamentalsForCharts();

    return NextResponse.json(data);
  } catch (error) {
    console.error(
      "Erreur test historique fundamentals :",
      error
    );

    return NextResponse.json(
      {
        error:
          "Impossible de récupérer l'historique des fondamentaux",
      },
      { status: 500 }
    );
  }
}