import {
  NextRequest,
  NextResponse,
} from "next/server";
import YahooFinance from "yahoo-finance2";
import {
  getHistoricalFundamentalsForSymbol,
} from "@/lib/fundamentals";
import {
  getStockAnalysisHistoricalBalanceSheet,
  type StockAnalysisHistoricalBalanceSheet,
} from "@/lib/financials/stockanalysis";
import {
  calculateFinancialCriteria,
  type AnnualFinancialData,
} from "@/lib/CalculsFinancialData";
export const dynamic = "force-dynamic";
const yahooFinance =
  new YahooFinance();
/* =========================================================
   TYPES
   ========================================================= */
type QuarterlyBalanceSheetRow = {
  date?: Date | string | number | null;
  totalDebt?: number | null;
  cashAndCashEquivalents?:
    | number
    | null;
  cashCashEquivalentsAndShortTermInvestments?:
    | number
    | null;
};
type SuperRoicYear = {
  year: number;
  value: number | null;
};
type SuperRoicResult = {
  average: number | null;
  yearly: SuperRoicYear[];
  completeYears: number;
};
type YahooHistoricalData =
  Awaited<
    ReturnType<
      typeof getHistoricalFundamentalsForSymbol
    >
  >;
type YahooHistoricalRow =
  YahooHistoricalData[number];
type MergedHistoricalRow =
  YahooHistoricalRow & {
    totalAssets: number | null;
    goodwill: number | null;
    currentLiabilities: number | null;
  };
/* =========================================================
   HELPERS
   ========================================================= */
function toNumber(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }
  return null;
}
/**
 * Transforme le symbole Yahoo en ticker
 * exploitable par notre scraper StockAnalysis.
 *
 * Exemples :
 *
 * AAPL    -> AAPL
 * MSFT    -> MSFT
 * MC.PA   -> MC
 * RMS.PA  -> RMS
 */
function getStockAnalysisTicker(
  symbol: string
): string {
  const normalized =
    symbol
      .trim()
      .toUpperCase();
  if (
    normalized.endsWith(
      ".PA"
    )
  ) {
    return normalized.slice(
      0,
      -3
    );
  }
  return normalized;
}
/**
 * =========================================================
 * STOCKANALYSIS — HISTORIQUE
 * =========================================================
 *
 * StockAnalysis est une source complémentaire.
 *
 * Une panne ou une entreprise non supportée
 * ne doit jamais faire tomber toute la route.
 */
async function getStockAnalysisHistorySafe(
  symbol: string
): Promise<
  StockAnalysisHistoricalBalanceSheet[]
> {
  try {
    const ticker =
      getStockAnalysisTicker(
        symbol
      );
    return await getStockAnalysisHistoricalBalanceSheet(
      ticker
    );
  } catch (error) {
    console.error(
      `⚠️ StockAnalysis historique indisponible pour ${symbol}:`,
      error
    );
    return [];
  }
}
/**
 * =========================================================
 * FUSION YAHOO + STOCKANALYSIS
 * =========================================================
 *
 * Yahoo reste la source principale.
 *
 * StockAnalysis complète uniquement les champs
 * nécessaires au Super ROIC lorsqu'ils sont
 * absents chez Yahoo :
 *
 * - Total Assets
 * - Goodwill
 * - Current Liabilities
 *
 * Pour le Goodwill :
 *
 * la normalisation Apple est déjà effectuée dans
 * lib/financials/stockanalysis.ts.
 */
function mergeHistoricalSources(
  yahooRows: YahooHistoricalData,
  stockAnalysisRows:
    StockAnalysisHistoricalBalanceSheet[]
): MergedHistoricalRow[] {
  const stockAnalysisByYear =
    new Map<
      number,
      StockAnalysisHistoricalBalanceSheet
    >();
  for (
    const row of stockAnalysisRows
  ) {
    stockAnalysisByYear.set(
      row.year,
      row
    );
  }
  return yahooRows.map(
    (
      yahooRow
    ): MergedHistoricalRow => {
      const stockAnalysisRow =
        stockAnalysisByYear.get(
          yahooRow.year
        );
      return {
        ...yahooRow,
        totalAssets:
          yahooRow.totalAssets ??
          stockAnalysisRow
            ?.totalAssets ??
          null,
        goodwill:
          yahooRow.goodwill ??
          stockAnalysisRow
            ?.goodwill ??
          null,
        currentLiabilities:
          yahooRow.currentLiabilities ??
          stockAnalysisRow
            ?.currentLiabilities ??
          null,
      };
    }
  );
}
/**
 * =========================================================
 * SUPER ROIC
 * =========================================================
 *
 * Formule :
 *
 *              FCF - SBC
 * --------------------------------
 * Total Assets - Goodwill
 *               - Current Liabilities
 *
 * × 100
 */
function calculateSuperRoicForYear(
  row: {
    freeCashFlow: number | null;
    stockBasedCompensation:
      | number
      | null;
    totalAssets: number | null;
    goodwill: number | null;
    currentLiabilities:
      | number
      | null;
  }
): number | null {
  const {
    freeCashFlow,
    stockBasedCompensation,
    totalAssets,
    goodwill,
    currentLiabilities,
  } = row;
  if (
    freeCashFlow == null ||
    stockBasedCompensation ==
      null ||
    totalAssets == null ||
    goodwill == null ||
    currentLiabilities == null
  ) {
    return null;
  }
  const numerator =
    freeCashFlow -
    stockBasedCompensation;
  const denominator =
    totalAssets -
    goodwill -
    currentLiabilities;
  if (
    denominator <= 0 ||
    !Number.isFinite(
      denominator
    )
  ) {
    return null;
  }
  const result =
    (
      numerator /
      denominator
    ) * 100;
  return Number.isFinite(
    result
  )
    ? result
    : null;
}
function calculateFiveYearSuperRoic(
  annual:
    MergedHistoricalRow[],
  years: number[]
): SuperRoicResult {
  const yearly =
    years.map(
      (year) => {
        const row =
          annual.find(
            (item) =>
              item.year ===
              year
          );
        return {
          year,
          value: row
            ? calculateSuperRoicForYear(
                row
              )
            : null,
        };
      }
    );
  const validValues =
    yearly
      .map(
        (item) =>
          item.value
      )
      .filter(
        (
          value
        ): value is number =>
          value !== null
      );
  /**
   * Le Super ROIC moyen n'est affiché
   * que si les 5 exercices demandés
   * sont réellement calculables.
   */
  if (
    validValues.length !==
    years.length
  ) {
    return {
      average: null,
      yearly,
      completeYears:
        validValues.length,
    };
  }
  const average =
    validValues.reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    ) /
    validValues.length;
  return {
    average,
    yearly,
    completeYears:
      validValues.length,
  };
}
/**
 * =========================================================
 * DERNIER BILAN TRIMESTRIEL
 * =========================================================
 *
 * Sert au critère :
 *
 * Dette nette / FCF
 *
 * Dette nette =
 * Dette totale
 * - Cash & Short-Term Investments
 */
async function getLatestQuarterlyNetDebt(
  symbol: string
): Promise<{
  netDebt: number | null;
  totalDebt: number | null;
  cashAndShortTermInvestments:
    | number
    | null;
}> {
  try {
    const currentYear =
      new Date()
        .getUTCFullYear();
    const rows =
      await yahooFinance
        .fundamentalsTimeSeries(
          symbol,
          {
            period1:
              `${currentYear - 2}-01-01`,
            period2:
              `${currentYear + 1}-01-01`,
            type:
              "quarterly",
            module:
              "balance-sheet",
          }
        );
    if (
      !Array.isArray(
        rows
      ) ||
      rows.length === 0
    ) {
      return {
        netDebt: null,
        totalDebt: null,
        cashAndShortTermInvestments:
          null,
      };
    }
    const sorted =
      (
        rows as
          QuarterlyBalanceSheetRow[]
      )
        .slice()
        .sort(
          (
            a,
            b
          ) => {
            const dateA =
              a.date
                ? new Date(
                    a.date
                  ).getTime()
                : 0;
            const dateB =
              b.date
                ? new Date(
                    b.date
                  ).getTime()
                : 0;
            return (
              dateB -
              dateA
            );
          }
        );
    for (
      const row of sorted
    ) {
      const totalDebt =
        toNumber(
          row.totalDebt
        );
      const cashAndShortTermInvestments =
        toNumber(
          row
            .cashCashEquivalentsAndShortTermInvestments
        ) ??
        toNumber(
          row
            .cashAndCashEquivalents
        );
      if (
        totalDebt !== null &&
        cashAndShortTermInvestments !==
          null
      ) {
        return {
          totalDebt,
          cashAndShortTermInvestments,
          netDebt:
            totalDebt -
            cashAndShortTermInvestments,
        };
      }
    }
    return {
      netDebt: null,
      totalDebt: null,
      cashAndShortTermInvestments:
        null,
    };
  } catch (error) {
    console.error(
      `⚠️ Impossible de récupérer le bilan trimestriel Yahoo pour ${symbol}:`,
      error
    );
    return {
      netDebt: null,
      totalDebt: null,
      cashAndShortTermInvestments:
        null,
    };
  }
}
/* =========================================================
   ROUTE
   ========================================================= */
export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl
        .searchParams;
    const symbol =
      searchParams
        .get("symbol")
        ?.trim()
        .toUpperCase();
    if (!symbol) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Aucun symbole boursier fourni.",
        },
        {
          status: 400,
        }
      );
    }
    /* =====================================================
       RÉCUPÉRATION DES DONNÉES
       ===================================================== */
    const [
      yahooHistorical,
      stockAnalysisHistorical,
      latestQuarterlyBalanceSheet,
    ] =
      await Promise.all([
        getHistoricalFundamentalsForSymbol(
          symbol
        ),
        getStockAnalysisHistorySafe(
          symbol
        ),
        getLatestQuarterlyNetDebt(
          symbol
        ),
      ]);
    if (
      yahooHistorical.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          symbol,
          error:
            "Aucune donnée financière trouvée pour cette entreprise.",
          annual: [],
        },
        {
          status: 404,
        }
      );
    }
    /* =====================================================
       FUSION YAHOO + STOCKANALYSIS
       ===================================================== */
    const historical =
      mergeHistoricalSources(
        yahooHistorical,
        stockAnalysisHistorical
      );
    /* =====================================================
       ANNÉES DISPONIBLES
       ===================================================== */
    const annual =
      historical
        .slice()
        .sort(
          (
            a,
            b
          ) =>
            a.year -
            b.year
        );
    /**
     * On prend les 5 exercices annuels
     * les plus récents réellement disponibles.
     *
     * Il n'y a donc aucune période 2021-2025
     * codée en dur.
     */
    const latestFiveAnnual =
      annual.slice(-5);
    if (
      latestFiveAnnual.length ===
      0
    ) {
      return NextResponse.json(
        {
          success: false,
          symbol,
          error:
            "Aucune année financière exploitable.",
          annual: [],
        },
        {
          status: 404,
        }
      );
    }
    const startYear =
      latestFiveAnnual[0]
        .year;
    const endYear =
      latestFiveAnnual[
        latestFiveAnnual.length -
          1
      ].year;
    const years =
      latestFiveAnnual.map(
        (row) =>
          row.year
      );
    /* =====================================================
       NORMALISATION POUR LE MOTEUR CENTRAL
       ===================================================== */
    const calculationData:
      AnnualFinancialData[] =
      latestFiveAnnual.map(
        (row) => ({
          year:
            row.year,
          revenue:
            row.revenue,
          freeCashFlow:
            row.freeCashFlow,
          dilutedAverageShares:
            row.dilutedShares,
          operatingIncome:
            row.operatingIncome,
          totalDebt:
            row.totalDebt,
          cashAndShortTermInvestments:
            row
              .cashAndShortTermInvestments,
        })
      );
    /* =====================================================
       DERNIER FCF
       ===================================================== */
    const latestAnnualWithFcf =
      [...latestFiveAnnual]
        .reverse()
        .find(
          (row) =>
            row.freeCashFlow !==
            null
        );
    const latestFreeCashFlow =
      latestAnnualWithFcf
        ?.freeCashFlow ??
      null;
    const latestFreeCashFlowYear =
      latestAnnualWithFcf
        ?.year ??
      null;
    /* =====================================================
       CRITÈRES 1, 2, 3, 4 ET 6
       ===================================================== */
    const calculatedCriteria =
      calculateFinancialCriteria(
        calculationData,
        {
          netDebt:
            latestQuarterlyBalanceSheet
              .netDebt,
          freeCashFlow:
            latestFreeCashFlow,
          freeCashFlowYear:
            latestFreeCashFlowYear,
        },
        startYear,
        endYear
      );
    /* =====================================================
       CRITÈRE 5 — SUPER ROIC
       ===================================================== */
    const superRoic =
      calculateFiveYearSuperRoic(
        latestFiveAnnual,
        years
      );
    /* =====================================================
       RÉPONSE
       ===================================================== */
    return NextResponse.json({
      success: true,
      symbol,
      period: {
        startYear,
        endYear,
        years,
      },
      annual,
      latestQuarterlyBalanceSheet:
        {
          totalDebt:
            latestQuarterlyBalanceSheet
              .totalDebt,
          cashAndShortTermInvestments:
            latestQuarterlyBalanceSheet
              .cashAndShortTermInvestments,
          netDebt:
            latestQuarterlyBalanceSheet
              .netDebt,
        },
      latestFreeCashFlow: {
        year:
          latestFreeCashFlowYear,
        value:
          latestFreeCashFlow,
      },
      criteria: {
        revenueGrowthCagr:
          calculatedCriteria
            .revenueGrowthCagr,
        netDebtToFCF:
          calculatedCriteria
            .netDebtToFCF,
        freeCashFlowGrowthCagr:
          calculatedCriteria
            .freeCashFlowGrowthCagr,
        dilutedSharesChange:
          calculatedCriteria
            .dilutedSharesChange,
        superRoic:
          superRoic.average,
        averageFcfMargin:
          calculatedCriteria
            .averageFcfMargin,
      },
      superRoicDetails: {
        yearly:
          superRoic.yearly,
        completeYears:
          superRoic
            .completeYears,
        requiredYears:
          years.length,
      },
      historicalSuperRoic:
        annual.map((row) => ({
          year: row.year,
          value:
            calculateSuperRoicForYear(
              row
            ),
        })),
      /**
       * Diagnostic temporaire.
       *
       * Il nous permettra de vérifier que
       * StockAnalysis a réellement complété
       * les données attendues.
       *
       * On pourra le supprimer une fois
       * le moteur validé.
       */
      sources: {
        historicalEngine:
          "Börsenlotse + Yahoo",
        yahoo:
          true,
        boersenlotse:
          true,
        stockAnalysis:
          stockAnalysisHistorical
            .length > 0,
      },
    });
  } catch (error) {
    console.error(
      "❌ Erreur /api/company-financials:",
      error
    );
    const message =
      error instanceof Error
        ? error.message
        : String(error);
    return NextResponse.json(
      {
        success: false,
        error:
          message,
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
