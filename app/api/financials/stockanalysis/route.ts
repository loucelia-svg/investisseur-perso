import { NextResponse } from "next/server";
import {
  getStockAnalysisFinancialData,
} from "@/lib/financials/stockanalysis";

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const ticker =
      searchParams.get("ticker");

    if (!ticker) {
      return NextResponse.json(
        {
          error:
            "Paramètre ticker manquant. Exemple : ?ticker=MC",
        },
        { status: 400 }
      );
    }

    const data =
      await getStockAnalysisFinancialData(
        ticker.toUpperCase()
      );

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      ...data,
    });
  } catch (error) {
    console.error(
      "Erreur StockAnalysis :",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}