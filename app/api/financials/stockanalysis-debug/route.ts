import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  debugStockAnalysisBalanceSheet,
} from "@/lib/financials/stockanalysis";

export const dynamic = "force-dynamic";

/**
 * =========================================================
 * DIAGNOSTIC STOCKANALYSIS — BALANCE SHEET
 * =========================================================
 *
 * Exemple :
 *
 * /api/financials/stockanalysis-debug?ticker=AAPL
 *
 * Cette route ne modifie aucun calcul de l'application.
 *
 * Elle sert uniquement à voir les vraies clés
 * disponibles dans le bilan StockAnalysis.
 */
export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl.searchParams;

    const ticker =
      searchParams
        .get("ticker")
        ?.trim()
        .toUpperCase();

    if (!ticker) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Aucun ticker fourni.",
        },
        {
          status: 400,
        }
      );
    }

    const balanceSheet =
      await debugStockAnalysisBalanceSheet(
        ticker
      );

    return NextResponse.json({
      success: true,
      ticker,
      balanceSheet,
    });
  } catch (error) {
    console.error(
      "❌ Erreur diagnostic StockAnalysis :",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),

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