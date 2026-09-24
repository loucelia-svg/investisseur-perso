import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

const SYMBOLS = {
  LVMH: "MC.PA",
  "Hermès": "RMS.PA",
} as const;

export async function GET() {
  try {
    const result: Record<
      string,
      {
        date: string;
        close: number;
      }[]
    > = {};

    for (const [company, symbol] of Object.entries(SYMBOLS)) {
      const chart = await yahooFinance.chart(
        symbol,
        {
          period1: "2001-01-01",
          period2: new Date(),
          interval: "1mo",
        }
      );

      result[company] = chart.quotes
        .filter(
          (item) =>
            item.date &&
            item.close !== null &&
            item.close !== undefined
        )
        .map((item) => ({
          date: new Date(item.date).toISOString(),
          close: Number(item.close),
        }));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "Erreur cours historiques :",
      error
    );

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