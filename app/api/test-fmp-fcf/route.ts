import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET() {
  try {
    const results: Record<string, unknown> = {};

    for (const symbol of ["MC.PA", "RMS.PA"]) {
      const data =
        await yahooFinance.fundamentalsTimeSeries(symbol, {
          period1: "2024-01-01",
          period2: "2026-12-31",
          type: "quarterly",
          module: "cash-flow",
        });

      results[symbol] = data.map((item: any) => ({
        date: item.date,
        periodType: item.periodType,
        freeCashFlow: item.freeCashFlow,
        operatingCashFlow: item.operatingCashFlow,
        capitalExpenditure: item.capitalExpenditure,
      }));
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Erreur Yahoo FCF :", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}