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
type TtmFundamentals = {
  revenue: number | null;
  freeCashFlow: number | null;
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
      const sbc = fundamental && isFiniteNumber(fundamental.stockBasedCompensation)
        ? fundamental.stockBasedCompensation
        : null;
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
        history: pfcfHistory,
      },
      ps: {
        current: currentPs,
        historicalAverage: historicalAveragePs,
        average5Years: averagePs5Years,
        average10Years: averagePs10Years,
        history: psHistory,
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
