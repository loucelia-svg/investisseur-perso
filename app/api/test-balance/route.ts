import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET() {
  try {
    const [lvmh, hermes] = await Promise.all([
      yahooFinance.fundamentalsTimeSeries("MC.PA", {
        period1: "2021-01-01",
        period2: "2026-01-01",
        type: "annual",
        module: "all",
      }),

      yahooFinance.fundamentalsTimeSeries("RMS.PA", {
        period1: "2021-01-01",
        period2: "2026-01-01",
        type: "annual",
        module: "all",
      }),
    ]);

    const getAnnualBalance = (data: any[]) => {
      return data
        .filter((item) => {
          const year = item.date.getUTCFullYear();
          return year >= 2021 && year <= 2025;
        })
        .map((item) => ({
          year: item.date.getUTCFullYear(),
          totalDebt: item.totalDebt ?? null,
          cashAndShortTermInvestments:
            item.cashCashEquivalentsAndShortTermInvestments ?? null,
          stockholdersEquity: item.stockholdersEquity ?? null,
        }))
        .sort((a, b) => a.year - b.year);
    };

    return NextResponse.json({
      LVMH: getAnnualBalance(lvmh),
      Hermès: getAnnualBalance(hermes),
    });
  } catch (error) {
    console.error("Erreur test balance annuel :", error);

    return NextResponse.json(
      { error: "Impossible de récupérer les bilans annuels" },
      { status: 500 }
    );
  }
}