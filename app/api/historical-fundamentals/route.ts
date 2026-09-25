import { NextResponse } from "next/server";

import {
  getHistoricalFundamentalsForCharts,
} from "@/lib/fundamentals";

/**
 * Page II — Graphiques
 *
 * Les données historiques sont mises en cache pendant 24 heures.
 * Cela évite de rappeler Börsenlotse et Yahoo à chaque chargement
 * de la page Graphiques.
 */
export const revalidate = 86400;

export async function GET() {
  try {
    const data =
      await getHistoricalFundamentalsForCharts();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error(
      "❌ Erreur /api/historical-fundamentals:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error: message,
        details:
          error instanceof Error
            ? error.stack
            : undefined,
      },
      {
        status: 500,
      }
    );
  }
}