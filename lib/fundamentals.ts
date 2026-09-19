import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export type AnnualFundamentals = {
  year: number;
  freeCashFlow: number | null;
  revenue: number | null;
  operatingIncome: number | null;
  taxProvision: number | null;
  pretaxIncome: number | null;
  dilutedAverageShares: number | null;
  stockholdersEquity: number | null;
  netIncome: number | null;
  totalDebt: number | null;
  cashAndShortTermInvestments: number | null;
};

export async function getFundamentals(
  symbol: string
): Promise<AnnualFundamentals[]> {
  const requests = [
    yahooFinance.fundamentalsTimeSeries(symbol, {
      period1: "2021-01-01",
      period2: "2022-01-01",
      type: "annual",
      module: "all",
    }),

    yahooFinance.fundamentalsTimeSeries(symbol, {
      period1: "2022-01-01",
      period2: "2026-01-01",
      type: "annual",
      module: "all",
    }),
  ];

  const [firstYear, remainingYears] =
    await Promise.all(requests);

  const data = [...firstYear, ...remainingYears];

  return data
    .filter((item) => {
      const year = item.date.getUTCFullYear();
      return year >= 2021 && year <= 2025;
    })
    .map((item) => ({
      year: item.date.getUTCFullYear(),

      freeCashFlow: item.freeCashFlow ?? null,

      revenue: item.totalRevenue ?? null,

      operatingIncome: item.operatingIncome ?? null,

      taxProvision: item.taxProvision ?? null,

      pretaxIncome: item.pretaxIncome ?? null,

      dilutedAverageShares:
        item.dilutedAverageShares ?? null,

      stockholdersEquity:
        item.stockholdersEquity ?? null,

      netIncome: item.netIncome ?? null,

      totalDebt: item.totalDebt ?? null,

      cashAndShortTermInvestments:
        item.cashCashEquivalentsAndShortTermInvestments ??
        null,
    }))
    .sort((a, b) => a.year - b.year);
}