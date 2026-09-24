import { NextResponse } from "next/server";

import {
  getHistoricalFundamentalsForCharts,
} from "@/lib/fundamentals";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data =
      await getHistoricalFundamentalsForCharts();

    return NextResponse.json(data);
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