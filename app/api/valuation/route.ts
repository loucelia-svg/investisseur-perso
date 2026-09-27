import {
  NextRequest,
  NextResponse,
} from "next/server";
import YahooFinance from "yahoo-finance2";
import {
  getHistoricalFundamentalsForSymbol,
} from "@/lib/fundamentals";
const yahooFinance =
  new YahooFinance();
const COMPANY_SYMBOLS: Record<
  string,
  string
> = {
  LVMH: "MC.PA",
  "Hermès": "RMS.PA",
  Hermes: "RMS.PA",
};
type HistoricalPricePoint = {
  year: number;
  price: number;
};
type HistoricalDailyPricePoint = {
  date: string;
  year: number;
  price: number;
};
type FcfPerSharePoint = {
  year: number;
  freeCashFlow: number;
  dilutedShares: number;
  normalizedDilutedShares: number;
  freeCashFlowPerShare: number;
};
type GrowthPoint = {
  year: number;
  growth: number;
};
type HistoricalPfcfPoint = {
  year: number;
  price: number;
  freeCashFlow: number;
  dilutedShares: number;
  normalizedDilutedShares: number;
  freeCashFlowPerShare: number;
  pfcf: number;
  pfcfExSbc: number | null;
};
type HistoricalPsPoint = {
  year: number;
  price: number;
  revenue: number;
  dilutedShares: number;
  normalizedDilutedShares: number;
  revenuePerShare: number;
  ps: number;
};
type HistoricalPfcfDailyPoint = {
  date: string;
  year: number;
  price: number;
  pfcf: number;
  pfcfExSbc: number | null;
};
type HistoricalPsDailyPoint = {
  date: string;
  year: number;
  price: number;
  ps: number;
};
type HistoricalPocfDailyPoint = { date: string; year: number; price: number; pocf: number; };
type HistoricalPeDailyPoint = { date: string; year: number; price: number; pe: number; };
type AnnualEarningsCashFlowPoint = {
  year: number;
  operatingCashFlow: number | null;
  netIncome: number | null;
  dilutedShares: number | null;
};
const LVMH_SBC_ANNUAL_FALLBACK: Record<number, number> = {
  2024: 127_000_000,
  2025: 165_000_000,
};
function getAnnualSbc(
  symbol: string,
  year: number,
  providerValue: number | null | undefined
): number | null {
  if (
    typeof providerValue === "number" &&
    Number.isFinite(providerValue) &&
    providerValue >= 0
  ) {
    return providerValue;
  }
  if (symbol === "MC.PA") {
    return LVMH_SBC_ANNUAL_FALLBACK[year] ?? null;
  }
  return null;
}
function isFiniteNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  );
}
function getYearFromDate(
  value: unknown
): number | null {
  if (value instanceof Date) {
    const year =
      value.getUTCFullYear();
    return Number.isFinite(year)
      ? year
      : null;
  }
  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const date =
      new Date(value);
    if (
      !Number.isNaN(
        date.getTime()
      )
    ) {
      return date.getUTCFullYear();
    }
  }
  return null;
}
/*
 * Même convention que sur la page Graphiques :
 *
 * - > 1 000 000 : nombre d'actions déjà en unités
 * - sinon : nombre d'actions exprimé en millions
 */
function normalizeShares(
  shares: number | null
): number | null {
  if (
    shares === null ||
    !Number.isFinite(shares) ||
    shares <= 0
  ) {
    return null;
  }
  return shares > 1_000_000
    ? shares
    : shares * 1_000_000;
}
function calculateFcfPerShare(
  freeCashFlow: number | null,
  dilutedShares: number | null
): number | null {
  if (
    freeCashFlow === null ||
    !Number.isFinite(
      freeCashFlow
    ) ||
    freeCashFlow <= 0
  ) {
    return null;
  }
  const normalizedShares =
    normalizeShares(
      dilutedShares
    );
  if (
    normalizedShares === null ||
    normalizedShares <= 0
  ) {
    return null;
  }
  const result =
    freeCashFlow /
    normalizedShares;
  return Number.isFinite(result) &&
    result > 0
    ? result
    : null;
}
function average(
  values: number[]
): number | null {
  const valid =
    values.filter(
      (value) =>
        Number.isFinite(value)
    );
  if (
    valid.length === 0
  ) {
    return null;
  }
  return (
    valid.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / valid.length
  );
}
function getRecentValues<T extends {
  year: number;
}>(
  rows: T[],
  years: number
): T[] {
  if (
    rows.length === 0
  ) {
    return [];
  }
  const latestYear =
    rows[
      rows.length - 1
    ].year;
  const minimumYear =
    latestYear -
    years +
    1;
  return rows.filter(
    (row) =>
      row.year >=
      minimumYear
  );
}
function getAverageFcfPerShare(
  rows: FcfPerSharePoint[],
  years: number
): number | null {
  const recent =
    getRecentValues(
      rows,
      years
    );
  return average(
    recent.map(
      (row) =>
        row.freeCashFlowPerShare
    )
  );
}
function getAverageGrowth(
  rows: GrowthPoint[],
  years: number
): number | null {
  const recent =
    getRecentValues(
      rows,
      years
    );
  return average(
    recent.map(
      (row) =>
        row.growth
    )
  );
}
function getAveragePfcf(
  rows: HistoricalPfcfPoint[],
  years: number
): number | null {
  const recent =
    getRecentValues(
      rows,
      years
    );
  return average(
    recent.map(
      (row) =>
        row.pfcf
    )
  );
}
function getAveragePs(
  rows: HistoricalPsPoint[],
  years: number
): number | null {
  const recent = getRecentValues(rows, years);
  return average(recent.map((row) => row.ps));
}
function median(values: number[]): number | null {
  const valid = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 === 0
    ? (valid[middle - 1] + valid[middle]) / 2
    : valid[middle];
}
function getRecentDailyMedian<T extends { date: string }>(
  rows: T[],
  years: number,
  getValue: (row: T) => number
): number | null {
  if (rows.length === 0) return null;
  const latestDate = new Date(rows[rows.length - 1].date);
  if (Number.isNaN(latestDate.getTime())) return null;
  const cutoff = new Date(latestDate);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return median(
    rows
      .filter((row) => {
        const date = new Date(row.date);
        return !Number.isNaN(date.getTime()) && date >= cutoff;
      })
      .map(getValue)
  );
}
type TtmFundamentals = {
  revenue: number | null;
  freeCashFlow: number | null;
  operatingCashFlow: number | null;
  netIncome: number | null;
  stockBasedCompensation: number | null;
  dilutedShares: number | null;
  totalAssets: number | null;
  goodwill: number | null;
  currentLiabilities: number | null;
  cashAndShortTermInvestments: number | null;
  totalDebt: number | null;
};
async function getTtmFundamentals(
  symbol: string
): Promise<TtmFundamentals> {
  const period2 = new Date();
  const period1 = new Date(period2);
  period1.setUTCFullYear(period1.getUTCFullYear() - 2);
  try {
    const modules = ["financials", "cash-flow", "balance-sheet"] as const;
    const results = await Promise.all(
      modules.map((module) =>
        yahooFinance.fundamentalsTimeSeries(
          symbol,
          {
            period1,
            period2,
            type: "quarterly",
            module,
          } as any
        )
      )
    );
    type DynamicFundamentalRow = Record<string, unknown>;
    const rows: DynamicFundamentalRow[] = results
      .flat()
      .filter(Boolean)
      .map(
        (row) =>
          row as unknown as DynamicFundamentalRow
      );
    const timestamp = (row: DynamicFundamentalRow) => {
      const raw = row.date;
      if (
        !(
          raw instanceof Date ||
          typeof raw === "string" ||
          typeof raw === "number"
        )
      ) {
        return 0;
      }
      const date =
        raw instanceof Date
          ? raw
          : new Date(raw);
      return Number.isNaN(date.getTime())
        ? 0
        : date.getTime();
    };
    rows.sort((a, b) => timestamp(b) - timestamp(a));
    const latestFour = (key: string) => {
      const seen = new Set<number>();
      const values: number[] = [];
      for (const row of rows) {
        const time = timestamp(row);
        const value = row[key];
        if (time <= 0 || seen.has(time) || !isFiniteNumber(value)) continue;
        seen.add(time);
        values.push(value);
        if (values.length === 4) break;
      }
      return values.length === 4
        ? values.reduce((sum, value) => sum + value, 0)
        : null;
    };
    const latestValue = (...keys: string[]) => {
      for (const row of rows) {
        for (const key of keys) {
          const value = row[key];
          if (isFiniteNumber(value) && value > 0) return value;
        }
      }
      return null;
    };
    return {
      revenue: latestFour("totalRevenue"),
      freeCashFlow: latestFour("freeCashFlow"),
      operatingCashFlow: latestFour("operatingCashFlow"),
      netIncome: latestFour("netIncome") ?? latestFour("netIncomeCommonStockholders"),
      stockBasedCompensation: latestFour("stockBasedCompensation"),
      dilutedShares: latestValue(
        "dilutedAverageShares",
        "ordinarySharesNumber",
        "shareIssued"
      ),
      totalAssets: latestValue("totalAssets"),
      goodwill: latestValue("goodwill"),
      currentLiabilities: latestValue("currentLiabilities"),
      cashAndShortTermInvestments: latestValue(
        "cashCashEquivalentsAndShortTermInvestments",
        "cashAndCashEquivalents",
        "cashFinancial"
      ),
      totalDebt: latestValue(
        "totalDebt",
        "totalNonCurrentLiabilitiesNetMinorityInterest"
      ),
    };
  } catch (error) {
    console.error(`Erreur TTM Yahoo ${symbol} :`, error);
    return {
      revenue: null,
      freeCashFlow: null,
      operatingCashFlow: null,
      netIncome: null,
      stockBasedCompensation: null,
      dilutedShares: null,
      totalAssets: null,
      goodwill: null,
      currentLiabilities: null,
      cashAndShortTermInvestments: null,
      totalDebt: null,
    };
  }
}
async function getAnnualEarningsCashFlow(symbol: string): Promise<AnnualEarningsCashFlowPoint[]> {
  const period2 = new Date();
  const period1 = new Date(Date.UTC(1980, 0, 1));
  try {
    const results = await Promise.all(
      (["financials", "cash-flow"] as const).map((module) =>
        yahooFinance.fundamentalsTimeSeries(
          symbol,
          { period1, period2, type: "annual", module } as any
        )
      )
    );
    type Row = Record<string, unknown>;
    const byYear = new Map<number, AnnualEarningsCashFlowPoint>();
    for (const raw of results.flat().filter(Boolean)) {
      const row = raw as unknown as Row;
      const year = getYearFromDate(row.date);
      if (year === null) continue;
      const current = byYear.get(year) ?? { year, operatingCashFlow: null, netIncome: null, dilutedShares: null };
      if (isFiniteNumber(row.operatingCashFlow)) current.operatingCashFlow = row.operatingCashFlow;
      const income = isFiniteNumber(row.netIncome) ? row.netIncome : row.netIncomeCommonStockholders;
      if (isFiniteNumber(income)) current.netIncome = income;
      const shares = isFiniteNumber(row.dilutedAverageShares)
        ? row.dilutedAverageShares
        : isFiniteNumber(row.ordinarySharesNumber) ? row.ordinarySharesNumber : row.shareIssued;
      if (isFiniteNumber(shares) && shares > 0) current.dilutedShares = shares;
      byYear.set(year, current);
    }
    return [...byYear.values()].sort((a, b) => a.year - b.year);
  } catch (error) {
    console.error(`Erreur historique OCF / bénéfice net Yahoo ${symbol} :`, error);
    return [];
  }
}
async function getCurrentQuote(
  symbol: string
) {
  const quote =
    await yahooFinance.quote(
      symbol
    );
  const regularMarketPrice =
    isFiniteNumber(
      quote.regularMarketPrice
    )
      ? quote.regularMarketPrice
      : null;
  const currency =
    typeof quote.currency ===
    "string"
      ? quote.currency
      : null;
  const shortName =
    typeof quote.shortName ===
    "string"
      ? quote.shortName
      : null;
  const longName =
    typeof quote.longName ===
    "string"
      ? quote.longName
      : null;
  return {
    price:
      regularMarketPrice,
    currency,
    name:
      longName ??
      shortName ??
      symbol,
  };
}
async function getHistoricalYearEndPrices(
  symbol: string
): Promise<
  HistoricalPricePoint[]
> {
  const currentYear =
    new Date().getUTCFullYear();
  const period1 =
    new Date(
      Date.UTC(
        1980,
        0,
        1
      )
    );
  const period2 =
    new Date(
      Date.UTC(
        currentYear + 1,
        0,
        10
      )
    );
  try {
    const rows =
      await yahooFinance.historical(
        symbol,
        {
          period1,
          period2,
          interval: "1mo",
        }
      );
    const byYear =
      new Map<
        number,
        number
      >();
    for (
      const row of rows
    ) {
      const year =
        getYearFromDate(
          row.date
        );
      const price =
        isFiniteNumber(
          row.adjClose
        )
          ? row.adjClose
          : isFiniteNumber(
                row.close
              )
            ? row.close
            : null;
      if (
        year === null ||
        price === null ||
        price <= 0
      ) {
        continue;
      }
      /*
       * Les données sont mensuelles.
       * La dernière valeur rencontrée
       * pour une année devient le
       * cours de fin d'année.
       */
      byYear.set(
        year,
        price
      );
    }
    return Array.from(
      byYear.entries()
    )
      .map(
        ([year, price]) => ({
          year,
          price,
        })
      )
      .sort(
        (a, b) =>
          a.year - b.year
      );
  } catch (error) {
    console.error(
      `Erreur historique de cours ${symbol} :`,
      error
    );
    return [];
  }
}
async function getHistoricalDailyPrices(
  symbol: string
): Promise<HistoricalDailyPricePoint[]> {
  const currentYear = new Date().getUTCFullYear();
  const period1 = new Date(Date.UTC(1980, 0, 1));
  const period2 = new Date(Date.UTC(currentYear + 1, 0, 10));
  try {
    const rows = await yahooFinance.historical(symbol, {
      period1,
      period2,
      interval: "1d",
    });
    return rows
      .map((row) => {
        const rawDate = row.date;
        const date =
          rawDate instanceof Date
            ? rawDate
            : new Date(rawDate);
        const price = isFiniteNumber(row.adjClose)
          ? row.adjClose
          : isFiniteNumber(row.close)
            ? row.close
            : null;
        if (
          Number.isNaN(date.getTime()) ||
          price === null ||
          price <= 0
        ) {
          return null;
        }
        return {
          date: date.toISOString().slice(0, 10),
          year: date.getUTCFullYear(),
          price,
        };
      })
      .filter(
        (row): row is HistoricalDailyPricePoint =>
          row !== null
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error(
      `Erreur historique quotidien de cours ${symbol} :`,
      error
    );
    return [];
  }
}
export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl
        .searchParams;
    const company =
      searchParams
        .get("company")
        ?.trim() ||
      "LVMH";
    const explicitSymbol =
      searchParams
        .get("symbol")
        ?.trim()
        .toUpperCase();
    const symbol =
      explicitSymbol ||
      COMPANY_SYMBOLS[
        company
      ] ||
      company.toUpperCase();
    const [
      historicalFundamentals,
      quote,
      historicalPrices,
      historicalDailyPrices,
      annualEarningsCashFlow,
      ttmFundamentals,
    ] = await Promise.all([
      getHistoricalFundamentalsForSymbol(
        symbol
      ),
      getCurrentQuote(
        symbol
      ),
      getHistoricalYearEndPrices(
        symbol
      ),
      getHistoricalDailyPrices(
        symbol
      ),
      getAnnualEarningsCashFlow(symbol),
      getTtmFundamentals(symbol),
    ]);
    const fundamentals =
      [
        ...historicalFundamentals,
      ].sort(
        (a, b) =>
          a.year - b.year
      );
    /*
     * =====================================================
     * HISTORIQUE FCF / ACTION
     * =====================================================
     */
    const fcfPerShareHistory:
      FcfPerSharePoint[] =
      [];
    for (
      const row of
      fundamentals
    ) {
      if (
        !isFiniteNumber(
          row.freeCashFlow
        ) ||
        row.freeCashFlow <=
          0 ||
        !isFiniteNumber(
          row.dilutedShares
        ) ||
        row.dilutedShares <=
          0
      ) {
        continue;
      }
      const normalizedShares =
        normalizeShares(
          row.dilutedShares
        );
      const freeCashFlowPerShare =
        calculateFcfPerShare(
          row.freeCashFlow,
          row.dilutedShares
        );
      if (
        normalizedShares ===
          null ||
        freeCashFlowPerShare ===
          null
      ) {
        continue;
      }
      fcfPerShareHistory.push({
        year:
          row.year,
        freeCashFlow:
          row.freeCashFlow,
        dilutedShares:
          row.dilutedShares,
        normalizedDilutedShares:
          normalizedShares,
        freeCashFlowPerShare,
      });
    }
    fcfPerShareHistory.sort(
      (a, b) =>
        a.year - b.year
    );
    const latestFcfPoint =
      fcfPerShareHistory.length >
      0
        ? fcfPerShareHistory[
            fcfPerShareHistory.length -
              1
          ]
        : null;
    /*
     * =====================================================
     * CROISSANCE ANNUELLE DU FCF / ACTION
     * =====================================================
     *
     * "Actuel" = variation entre les deux
     * derniers exercices consécutifs.
     *
     * Moyenne 5 ans / 10 ans =
     * moyenne arithmétique des variations
     * annuelles disponibles sur la période.
     */
    const growthHistory:
      GrowthPoint[] = [];
    for (
      let index = 1;
      index <
      fcfPerShareHistory.length;
      index += 1
    ) {
      const previous =
        fcfPerShareHistory[
          index - 1
        ];
      const current =
        fcfPerShareHistory[
          index
        ];
      /*
       * On ne compare que deux
       * exercices consécutifs.
       */
      if (
        current.year -
          previous.year !==
        1
      ) {
        continue;
      }
      if (
        previous.freeCashFlowPerShare <=
        0
      ) {
        continue;
      }
      const growth =
        ((current.freeCashFlowPerShare /
          previous.freeCashFlowPerShare) -
          1) *
        100;
      if (
        !Number.isFinite(
          growth
        )
      ) {
        continue;
      }
      growthHistory.push({
        year:
          current.year,
        growth,
      });
    }
    const currentGrowth =
      growthHistory.length >
      0
        ? growthHistory[
            growthHistory.length -
              1
          ].growth
        : null;
    /*
     * =====================================================
     * HISTORIQUE P/FCF
     * =====================================================
     */
    const priceByYear =
      new Map<
        number,
        number
      >();
    for (
      const row of
      historicalPrices
    ) {
      priceByYear.set(
        row.year,
        row.price
      );
    }
    const pfcfHistory:
      HistoricalPfcfPoint[] =
      [];
    for (
      const row of
      fcfPerShareHistory
    ) {
      const price =
        priceByYear.get(
          row.year
        );
      if (
        price === undefined ||
        price <= 0
      ) {
        continue;
      }
      const pfcf =
        price /
        row.freeCashFlowPerShare;
      if (
        !Number.isFinite(
          pfcf
        ) ||
        pfcf <= 0
      ) {
        continue;
      }
      const fundamental = fundamentals.find((item) => item.year === row.year);
      const sbc = getAnnualSbc(
        symbol,
        row.year,
        fundamental?.stockBasedCompensation
      );
      const adjustedFcf = sbc === null ? null : row.freeCashFlow - sbc;
      const adjustedFcfPerShare =
        adjustedFcf !== null && adjustedFcf > 0
          ? adjustedFcf / row.normalizedDilutedShares
          : null;
      const pfcfExSbc =
        adjustedFcfPerShare !== null && adjustedFcfPerShare > 0
          ? price / adjustedFcfPerShare
          : null;
      pfcfHistory.push({
        year: row.year,
        price,
        freeCashFlow: row.freeCashFlow,
        dilutedShares: row.dilutedShares,
        normalizedDilutedShares: row.normalizedDilutedShares,
        freeCashFlowPerShare: row.freeCashFlowPerShare,
        pfcf,
        pfcfExSbc:
          pfcfExSbc !== null && Number.isFinite(pfcfExSbc) && pfcfExSbc > 0
            ? pfcfExSbc
            : null,
      });
    }
    pfcfHistory.sort(
      (a, b) =>
        a.year - b.year
    );
    const psHistory: HistoricalPsPoint[] = [];
    for (const row of fundamentals) {
      const price = priceByYear.get(row.year);
      if (price === undefined || price <= 0) continue;
      if (!isFiniteNumber(row.revenue) || row.revenue <= 0) continue;
      if (!isFiniteNumber(row.dilutedShares) || row.dilutedShares <= 0) continue;
      const normalizedDilutedShares = normalizeShares(row.dilutedShares);
      if (normalizedDilutedShares === null) continue;
      const revenuePerShare = row.revenue / normalizedDilutedShares;
      if (!Number.isFinite(revenuePerShare) || revenuePerShare <= 0) continue;
      const ps = price / revenuePerShare;
      if (!Number.isFinite(ps) || ps <= 0) continue;
      psHistory.push({
        year: row.year,
        price,
        revenue: row.revenue,
        dilutedShares: row.dilutedShares,
        normalizedDilutedShares,
        revenuePerShare,
        ps,
      });
    }
    psHistory.sort((a, b) => a.year - b.year);
    /*
     * =====================================================
     * HISTORIQUES DATÉS POUR LES GRAPHIQUES
     * =====================================================
     *
     * Les historiques annuels restent utilisés pour les
     * moyennes et les calculs existants. Ces deux séries
     * quotidiennes servent uniquement aux graphiques.
     */
    const fcfByYear = new Map(
      fcfPerShareHistory.map((row) => [row.year, row])
    );
    const fundamentalByYear = new Map(
      fundamentals.map((row) => [row.year, row])
    );
    const sortedFcfYears = [...fcfByYear.keys()].sort(
      (a, b) => a - b
    );
    const sortedFundamentalYears = [
      ...fundamentalByYear.keys(),
    ].sort((a, b) => a - b);
    const latestYearAtOrBefore = (
      years: number[],
      targetYear: number
    ): number | null => {
      let match: number | null = null;
      for (const year of years) {
        if (year > targetYear) break;
        match = year;
      }
      return match;
    };
    const pfcfDailyHistory: HistoricalPfcfDailyPoint[] = [];
    const psDailyHistory: HistoricalPsDailyPoint[] = [];
    const pocfDailyHistory: HistoricalPocfDailyPoint[] = [];
    const peDailyHistory: HistoricalPeDailyPoint[] = [];
    const earningsCashFlowByYear = new Map(annualEarningsCashFlow.map((row) => [row.year, row]));
    const earningsCashFlowYears = [...earningsCashFlowByYear.keys()].sort((a, b) => a - b);
    for (const market of historicalDailyPrices) {
      const fcfYear = latestYearAtOrBefore(
        sortedFcfYears,
        market.year
      );
      if (fcfYear !== null) {
        const fcfRow = fcfByYear.get(fcfYear);
        if (
          fcfRow &&
          fcfRow.freeCashFlowPerShare > 0
        ) {
          const currentYear = new Date().getUTCFullYear();
          const ttmSharesForChart = normalizeShares(
            ttmFundamentals.dilutedShares
          );
          const useTtmForCurrentYear =
            market.year === currentYear &&
            ttmSharesForChart !== null &&
            ttmFundamentals.freeCashFlow !== null &&
            Number.isFinite(ttmFundamentals.freeCashFlow) &&
            ttmFundamentals.freeCashFlow > 0;
          const chartFcfPerShare =
            useTtmForCurrentYear
              ? ttmFundamentals.freeCashFlow! / ttmSharesForChart!
              : fcfRow.freeCashFlowPerShare;
          const pfcf =
            market.price /
            chartFcfPerShare;
          const fundamental =
            fundamentalByYear.get(fcfYear);
          const annualSbc = getAnnualSbc(
            symbol,
            fcfYear,
            fundamental?.stockBasedCompensation
          );
          const sbc =
            market.year === currentYear &&
            ttmFundamentals.stockBasedCompensation !== null &&
            Number.isFinite(ttmFundamentals.stockBasedCompensation) &&
            ttmFundamentals.stockBasedCompensation >= 0
              ? ttmFundamentals.stockBasedCompensation
              : annualSbc;
          const chartFcf =
            useTtmForCurrentYear
              ? ttmFundamentals.freeCashFlow
              : fcfRow.freeCashFlow;
          const chartShares =
            useTtmForCurrentYear
              ? ttmSharesForChart
              : fcfRow.normalizedDilutedShares;
          const adjustedFcf =
            sbc === null || chartFcf === null
              ? null
              : chartFcf - sbc;
          const adjustedFcfPerShare =
            adjustedFcf !== null &&
            adjustedFcf > 0 &&
            chartShares !== null &&
            chartShares > 0
              ? adjustedFcf / chartShares
              : null;
          const pfcfExSbc =
            adjustedFcfPerShare !== null &&
            adjustedFcfPerShare > 0
              ? market.price /
                adjustedFcfPerShare
              : null;
          if (
            Number.isFinite(pfcf) &&
            pfcf > 0
          ) {
            pfcfDailyHistory.push({
              date: market.date,
              year: market.year,
              price: market.price,
              pfcf,
              pfcfExSbc:
                pfcfExSbc !== null &&
                Number.isFinite(pfcfExSbc) &&
                pfcfExSbc > 0
                  ? pfcfExSbc
                  : null,
            });
          }
        }
      }
      const revenueYear =
        latestYearAtOrBefore(
          sortedFundamentalYears,
          market.year
        );
      if (revenueYear !== null) {
        const fundamental =
          fundamentalByYear.get(revenueYear);
        if (
          fundamental &&
          isFiniteNumber(fundamental.revenue) &&
          fundamental.revenue > 0 &&
          isFiniteNumber(
            fundamental.dilutedShares
          ) &&
          fundamental.dilutedShares > 0
        ) {
          const shares = normalizeShares(
            fundamental.dilutedShares
          );
          if (
            shares !== null &&
            shares > 0
          ) {
            const revenuePerShare =
              fundamental.revenue / shares;
            const ps =
              market.price /
              revenuePerShare;
            if (
              Number.isFinite(ps) &&
              ps > 0
            ) {
              psDailyHistory.push({
                date: market.date,
                year: market.year,
                price: market.price,
                ps,
              });
            }
          }
        }
      }
      const earningsYear = latestYearAtOrBefore(earningsCashFlowYears, market.year);
      const earningsRow = earningsYear === null ? null : earningsCashFlowByYear.get(earningsYear) ?? null;
      const isCurrentYear = market.year === new Date().getUTCFullYear();
      const ttmSharesForMultiple = normalizeShares(ttmFundamentals.dilutedShares);
      const annualSharesForMultiple = normalizeShares(earningsRow?.dilutedShares ?? null);
      const sharesForMultiple = isCurrentYear && ttmSharesForMultiple !== null
        ? ttmSharesForMultiple
        : annualSharesForMultiple;
      const ocfForMultiple = isCurrentYear && ttmFundamentals.operatingCashFlow !== null
        ? ttmFundamentals.operatingCashFlow
        : earningsRow?.operatingCashFlow ?? null;
      const incomeForMultiple = isCurrentYear && ttmFundamentals.netIncome !== null
        ? ttmFundamentals.netIncome
        : earningsRow?.netIncome ?? null;
      if (sharesForMultiple !== null && sharesForMultiple > 0 && ocfForMultiple !== null && ocfForMultiple > 0) {
        const pocf = market.price / (ocfForMultiple / sharesForMultiple);
        if (Number.isFinite(pocf) && pocf > 0) {
          pocfDailyHistory.push({ date: market.date, year: market.year, price: market.price, pocf });
        }
      }
      if (sharesForMultiple !== null && sharesForMultiple > 0 && incomeForMultiple !== null && incomeForMultiple > 0) {
        const pe = market.price / (incomeForMultiple / sharesForMultiple);
        if (Number.isFinite(pe) && pe > 0) {
          peDailyHistory.push({ date: market.date, year: market.year, price: market.price, pe });
        }
      }
    }
    /*
     * =====================================================
     * VALEURS HISTORIQUES DU TABLEAU
     * =====================================================
     */
    const currentFcfPerShare =
      latestFcfPoint
        ?.freeCashFlowPerShare ??
      null;
    const averageFcfPerShare5Years =
      getAverageFcfPerShare(
        fcfPerShareHistory,
        5
      );
    const averageFcfPerShare10Years =
      getAverageFcfPerShare(
        fcfPerShareHistory,
        10
      );
    const averageGrowth5Years =
      getAverageGrowth(
        growthHistory,
        5
      );
    const averageGrowth10Years =
      getAverageGrowth(
        growthHistory,
        10
      );
    const averagePfcf5Years =
      getAveragePfcf(
        pfcfHistory,
        5
      );
    const averagePfcf10Years =
      getAveragePfcf(
        pfcfHistory,
        10
      );
    const historicalAveragePfcf =
      average(
        pfcfHistory.map(
          (row) =>
            row.pfcf
        )
      );
    const averagePs5Years = getAveragePs(psHistory, 5);
    const averagePs10Years = getAveragePs(psHistory, 10);
    const historicalAveragePs = average(psHistory.map((row) => row.ps));
    const latestFundamental = fundamentals.length > 0 ? fundamentals[fundamentals.length - 1] : null;
    const latestRevenuePerShare =
      latestFundamental && isFiniteNumber(latestFundamental.revenue) && latestFundamental.revenue > 0 &&
      isFiniteNumber(latestFundamental.dilutedShares)
        ? (() => {
            const shares = normalizeShares(latestFundamental.dilutedShares);
            return shares && shares > 0 ? latestFundamental.revenue / shares : null;
          })()
        : null;
    const currentPs =
      quote.price !== null && latestRevenuePerShare !== null && latestRevenuePerShare > 0
        ? quote.price / latestRevenuePerShare
        : null;
    /*
     * P/FCF actuel :
     *
     * cours actuel /
     * dernier FCF par action disponible.
     */
    const currentPfcf =
      quote.price !== null &&
      currentFcfPerShare !==
        null &&
      currentFcfPerShare > 0
        ? quote.price /
          currentFcfPerShare
        : null;
    const ttmShares = normalizeShares(ttmFundamentals.dilutedShares);
    const ttmFcfPerShare =
      ttmShares !== null &&
      ttmFundamentals.freeCashFlow !== null &&
      ttmFundamentals.freeCashFlow > 0
        ? ttmFundamentals.freeCashFlow / ttmShares
        : null;
    const ttmAdjustedFcfPerShare =
      ttmShares !== null &&
      ttmFundamentals.freeCashFlow !== null &&
      ttmFundamentals.stockBasedCompensation !== null &&
      ttmFundamentals.freeCashFlow - ttmFundamentals.stockBasedCompensation > 0
        ? (ttmFundamentals.freeCashFlow - ttmFundamentals.stockBasedCompensation) / ttmShares
        : null;
    const ttmRevenuePerShare =
      ttmShares !== null &&
      ttmFundamentals.revenue !== null &&
      ttmFundamentals.revenue > 0
        ? ttmFundamentals.revenue / ttmShares
        : null;
    const ttmPfcf =
      quote.price !== null && ttmFcfPerShare !== null && ttmFcfPerShare > 0
        ? quote.price / ttmFcfPerShare
        : null;
    const ttmPfcfExSbc =
      quote.price !== null &&
      ttmAdjustedFcfPerShare !== null &&
      ttmAdjustedFcfPerShare > 0
        ? quote.price / ttmAdjustedFcfPerShare
        : null;
    const ttmPs =
      quote.price !== null && ttmRevenuePerShare !== null && ttmRevenuePerShare > 0
        ? quote.price / ttmRevenuePerShare
        : null;
    const ttmOcfPerShare =
      ttmShares !== null &&
      ttmFundamentals.operatingCashFlow !== null &&
      ttmFundamentals.operatingCashFlow > 0
        ? ttmFundamentals.operatingCashFlow / ttmShares
        : null;
    const ttmEarningsPerShare =
      ttmShares !== null &&
      ttmFundamentals.netIncome !== null &&
      ttmFundamentals.netIncome > 0
        ? ttmFundamentals.netIncome / ttmShares
        : null;
    const currentPocf =
      quote.price !== null && ttmOcfPerShare !== null && ttmOcfPerShare > 0
        ? quote.price / ttmOcfPerShare
        : pocfDailyHistory.length > 0
          ? pocfDailyHistory[pocfDailyHistory.length - 1].pocf
          : null;
    const currentPe =
      quote.price !== null && ttmEarningsPerShare !== null && ttmEarningsPerShare > 0
        ? quote.price / ttmEarningsPerShare
        : peDailyHistory.length > 0
          ? peDailyHistory[peDailyHistory.length - 1].pe
          : null;
    const medianPfcf5Years = getRecentDailyMedian(
      pfcfDailyHistory.filter((row) => Number.isFinite(row.pfcf) && row.pfcf > 0),
      5,
      (row) => row.pfcf
    );
    const medianPfcf10Years = getRecentDailyMedian(
      pfcfDailyHistory.filter((row) => Number.isFinite(row.pfcf) && row.pfcf > 0),
      10,
      (row) => row.pfcf
    );
    const medianPs5Years = getRecentDailyMedian(psDailyHistory, 5, (row) => row.ps);
    const medianPs10Years = getRecentDailyMedian(psDailyHistory, 10, (row) => row.ps);
    const medianPocf5Years = getRecentDailyMedian(pocfDailyHistory, 5, (row) => row.pocf);
    const medianPocf10Years = getRecentDailyMedian(pocfDailyHistory, 10, (row) => row.pocf);
    const medianPe5Years = getRecentDailyMedian(peDailyHistory, 5, (row) => row.pe);
    const medianPe10Years = getRecentDailyMedian(peDailyHistory, 10, (row) => row.pe);
    return NextResponse.json({
      success: true,
      company:
        quote.name,
      requestedCompany:
        company,
      symbol,
      currency:
        quote.currency ??
        "EUR",
      currentPrice:
        quote.price,
      baseData: {
        year:
          latestFcfPoint
            ?.year ??
          null,
        freeCashFlow:
          latestFcfPoint
            ?.freeCashFlow ??
          null,
        dilutedShares:
          latestFcfPoint
            ?.dilutedShares ??
          null,
        normalizedDilutedShares:
          latestFcfPoint
            ?.normalizedDilutedShares ??
          null,
        freeCashFlowPerShare:
          currentFcfPerShare,
      },
      fcfPerShare: {
        current:
          currentFcfPerShare,
        average5Years:
          averageFcfPerShare5Years,
        average10Years:
          averageFcfPerShare10Years,
        history:
          fcfPerShareHistory,
      },
      growth: {
        current:
          currentGrowth,
        average5Years:
          averageGrowth5Years,
        average10Years:
          averageGrowth10Years,
        history:
          growthHistory,
      },
      pfcf: {
        current: currentPfcf,
        historicalAverage: historicalAveragePfcf,
        average5Years: averagePfcf5Years,
        average10Years: averagePfcf10Years,
        median5Years: medianPfcf5Years,
        median10Years: medianPfcf10Years,
        history: pfcfHistory,
        dailyHistory: pfcfDailyHistory,
      },
      ps: {
        current: currentPs,
        historicalAverage: historicalAveragePs,
        average5Years: averagePs5Years,
        average10Years: averagePs10Years,
        median5Years: medianPs5Years,
        median10Years: medianPs10Years,
        history: psHistory,
        dailyHistory: psDailyHistory,
      },
      pocf: {
        current: currentPocf,
        median5Years: medianPocf5Years,
        median10Years: medianPocf10Years,
        dailyHistory: pocfDailyHistory,
      },
      pe: {
        current: currentPe,
        median5Years: medianPe5Years,
        median10Years: medianPe10Years,
        dailyHistory: peDailyHistory,
      },
      ttm: {
        revenue: ttmFundamentals.revenue,
        freeCashFlow: ttmFundamentals.freeCashFlow,
        stockBasedCompensation: ttmFundamentals.stockBasedCompensation,
        dilutedShares: ttmFundamentals.dilutedShares,
        normalizedDilutedShares: ttmShares,
        totalAssets: ttmFundamentals.totalAssets,
        goodwill: ttmFundamentals.goodwill,
        currentLiabilities: ttmFundamentals.currentLiabilities,
        cashAndShortTermInvestments: ttmFundamentals.cashAndShortTermInvestments,
        totalDebt: ttmFundamentals.totalDebt,
        freeCashFlowPerShare: ttmFcfPerShare,
        adjustedFreeCashFlowPerShare: ttmAdjustedFcfPerShare,
        revenuePerShare: ttmRevenuePerShare,
        pfcf: ttmPfcf,
        pfcfExSbc: ttmPfcfExSbc,
        ps: ttmPs,
      },
      historicalPrices,
    });
  } catch (error) {
    console.error(
      "Erreur API Valorisation :",
      error
    );
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}
