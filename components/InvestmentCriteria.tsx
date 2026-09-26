"use client";
import localFont from "next/font/local";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

const unifraktur = localFont({
  src: "../app/fonts/UnifrakturMaguntia-Book.ttf",
  display: "swap",
});
type AnnualFundamental = {
  year: number;
  revenue: number | null;
  freeCashFlow: number | null;
  unleveredFreeCashFlow: number | null;
  dilutedAverageShares: number | null;
  totalDebt: number | null;
  cashAndShortTermInvestments: number | null;
  netDebt: number | null;
};
type CompanyData = {
  company: string;
  isin: string;
  symbol: string;
  annual: AnnualFundamental[];
  latestAnnual: AnnualFundamental | null;
};
type ApiResponse = {
  success: boolean;
  companies: {
    LVMH: CompanyData;
    Hermès: CompanyData;
  };
  error?: string;
};
type ValuationTtmResponse = {
  success: boolean;
  ttm?: {
    freeCashFlow: number | null;
  };
};
type StockAnalysisResponse = {
  balanceSheet?: {
    netDebt: number | null;
  };
  annualCashFlow?: {
    year: number;
    unleveredFreeCashFlow: number | null;
  };
};
/* =========================================================
   HISTORICAL FUNDAMENTALS
   ========================================================= */
type HistoricalFundamental = {
  year: number;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  freeCashFlow: number | null;
  unleveredFreeCashFlow: number | null;
  totalAssets: number | null;
  goodwill: number | null;
  currentLiabilities: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  totalDebt: number | null;
  cash: number | null;
  cashAndShortTermInvestments: number | null;
  dilutedShares: number | null;
  employees: number | null;
  stockBasedCompensation: number | null;
};
type HistoricalFundamentalsResponse = {
  LVMH: HistoricalFundamental[];
  Hermès: HistoricalFundamental[];
};
/*
 * LVMH : les rapports annuels donnent les dépenses
 * liées aux "Bonus share plans".
 *
 * Nous les utilisons ici pour compléter les deux années
 * actuellement absentes de /api/historical-fundamentals.
 *
 * Important :
 * 2024 : 127 M€
 * 2025 : 165 M€
 *
 * Ces valeurs sont en euros ici car l'API historique
 * travaille en euros.
 */
const LVMH_SBC_FALLBACK: Record<number, number> = {
  2024: 127_000_000,
  2025: 165_000_000,
};
/* =========================================================
   CRITERIA
   ========================================================= */
type Criterion = {
  id: string;
  title: string;
  subtitle: string;
  value: number | null;
  threshold: string;
  passed: boolean | null;
  disabled?: boolean;
};
/* =========================================================
   PROPS
   ========================================================= */
type InvestmentCriteriaProps = {
  company: "LVMH" | "Hermès";
};
/* =========================================================
   CALCULATION HELPERS
   ========================================================= */
function calculateCagr(
  start: number | null,
  end: number | null,
  years: number
): number | null {
  if (
    start === null ||
    end === null ||
    years <= 0 ||
    start <= 0 ||
    end <= 0
  ) {
    return null;
  }
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}
function calculateTotalChange(
  start: number | null,
  end: number | null
): number | null {
  if (
    start === null ||
    end === null ||
    start <= 0
  ) {
    return null;
  }
  return (end / start - 1) * 100;
}
function getCriteriaYears(
  data: AnnualFundamental[]
) {
  return [...data]
    .filter((item) => item.year >= 2020)
    .sort((a, b) => a.year - b.year);
}
function calculateAverageFcfMargin(
  data: AnnualFundamental[]
): number | null {
  const margins = data
    .map((item) => {
      if (
        item.freeCashFlow === null ||
        item.revenue === null ||
        item.revenue <= 0
      ) {
        return null;
      }
      return (
        (item.freeCashFlow / item.revenue) * 100
      );
    })
    .filter(
      (value): value is number =>
        value !== null
    );
  if (margins.length === 0) {
    return null;
  }
  return (
    margins.reduce(
      (sum, value) => sum + value,
      0
    ) / margins.length
  );
}
/* =========================================================
   SUPER ROIC
   ========================================================= */
/*
 * Formule exacte :
 *
 * Super ROIC =
 *
 * (FCF - SBC)
 * -------------------------------
 * Total Assets - Goodwill - Current Liabilities
 *
 * puis x 100
 */
function calculateSuperRoicForYear(
  data: HistoricalFundamental
): number | null {
  const fcf = data.freeCashFlow;
  let sbc = data.stockBasedCompensation;
  /*
   * L'API historique ne possède actuellement pas
   * les SBC LVMH 2024 et 2025.
   *
   * On complète uniquement ces deux années avec
   * les valeurs vérifiées dans les rapports annuels.
   */
  if (
    sbc === null &&
    data.year in LVMH_SBC_FALLBACK
  ) {
    sbc = LVMH_SBC_FALLBACK[data.year];
  }
  const totalAssets = data.totalAssets;
  const goodwill = data.goodwill;
  const currentLiabilities =
    data.currentLiabilities;
  if (
    fcf === null ||
    sbc === null ||
    totalAssets === null ||
    goodwill === null ||
    currentLiabilities === null
  ) {
    return null;
  }
  const numerator = fcf - sbc;
  const denominator =
    totalAssets -
    goodwill -
    currentLiabilities;
  if (denominator <= 0) {
    return null;
  }
  return (numerator / denominator) * 100;
}
function calculateFiveYearSuperRoic(
  data: HistoricalFundamental[]
): {
  average: number | null;
  yearly: {
    year: number;
    value: number | null;
  }[];
  completeYears: number;
} {
  const targetYears = [2021, 2022, 2023, 2024, 2025];
  const yearly = targetYears.map((year) => {
    const yearData =
      data.find(
        (item) => item.year === year
      ) ?? null;
    return {
      year,
      value: yearData
        ? calculateSuperRoicForYear(yearData)
        : null,
    };
  });
  const validValues = yearly
    .map((item) => item.value)
    .filter(
      (value): value is number =>
        value !== null
    );
  if (validValues.length !== 5) {
    return {
      average: null,
      yearly,
      completeYears: validValues.length,
    };
  }
  const average =
    validValues.reduce(
      (sum, value) => sum + value,
      0
    ) / validValues.length;
  return {
    average,
    yearly,
    completeYears: validValues.length,
  };
}
/* =========================================================
   FORMATTING
   ========================================================= */
function formatBillions(
  value: number | null
): string {
  if (value === null) {
    return "—";
  }
  return `${(value / 1_000).toFixed(2)} Md€`;
}
function formatRatio(
  value: number | null
): string {
  if (value === null) {
    return "—";
  }
  return value.toFixed(2);
}
/* =========================================================
   COMPONENT
   ========================================================= */
export default function InvestmentCriteria({
  company,
}: InvestmentCriteriaProps) {
  const router = useRouter();
  const [apiData, setApiData] =
    useState<ApiResponse | null>(null);
  const [
    stockAnalysisData,
    setStockAnalysisData,
  ] =
    useState<StockAnalysisResponse | null>(
      null
    );
  const [
    historicalData,
    setHistoricalData,
  ] =
    useState<HistoricalFundamentalsResponse | null>(
      null
    );
  const [valuationTtm, setValuationTtm] =
    useState<ValuationTtmResponse | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [criteriaOpen, setCriteriaOpen] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const stockAnalysisTicker =
          company === "LVMH"
            ? "MC"
            : "RMS";
        const [
          fundamentalsResponse,
          stockAnalysisResponse,
          historicalResponse,
          valuationResponse,
        ] = await Promise.all([
          fetch(
            "/api/test-fundamentals",
            {
              cache: "no-store",
            }
          ),
          fetch(
            `/api/financials/stockanalysis?ticker=${stockAnalysisTicker}`,
            {
              cache: "no-store",
            }
          ),
          fetch(
            "/api/historical-fundamentals",
            {
              cache: "no-store",
            }
          ),
          fetch(
            `/api/valuation?company=${encodeURIComponent(company)}`,
            {
              cache: "no-store",
            }
          ),
        ]);
        if (!fundamentalsResponse.ok) {
          throw new Error(
            `Erreur fondamentaux (${fundamentalsResponse.status})`
          );
        }
        const fundamentals =
          (await fundamentalsResponse.json()) as ApiResponse;
        let stockAnalysis:
          | StockAnalysisResponse
          | null = null;
        if (
          stockAnalysisResponse.ok
        ) {
          stockAnalysis =
            (await stockAnalysisResponse.json()) as StockAnalysisResponse;
        }
        let historical:
          | HistoricalFundamentalsResponse
          | null = null;
        if (
          historicalResponse.ok
        ) {
          historical =
            (await historicalResponse.json()) as HistoricalFundamentalsResponse;
        }
        let valuation:
          | ValuationTtmResponse
          | null = null;
        if (valuationResponse.ok) {
          valuation =
            (await valuationResponse.json()) as ValuationTtmResponse;
        }
        if (cancelled) {
          return;
        }
        setApiData(fundamentals);
        setStockAnalysisData(
          stockAnalysis
        );
        setHistoricalData(
          historical
        );
        setValuationTtm(
          valuation
        );
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "Impossible de récupérer les données."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [company]);
  /* =======================================================
     EXISTING FUNDAMENTAL DATA
     ======================================================= */
  const companyData =
    apiData?.companies?.[company] ??
    null;
  const annualData =
    companyData?.annual ?? [];
  const criteriaYears = useMemo(
    () =>
      getCriteriaYears(
        annualData
      ),
    [annualData]
  );
  const firstYear =
    criteriaYears[0]?.year ??
    null;
  const lastYear =
    criteriaYears[
      criteriaYears.length - 1
    ]?.year ?? null;
  const firstData =
    criteriaYears[0] ?? null;
  const lastData =
    criteriaYears[
      criteriaYears.length - 1
    ] ?? null;
  /* =======================================================
     CRITERION 1 — REVENUE CAGR
     ======================================================= */
  const revenueGrowth =
    firstData &&
    lastData &&
    firstYear !== null &&
    lastYear !== null
      ? calculateCagr(
          firstData.revenue,
          lastData.revenue,
          lastYear - firstYear
        )
      : null;
  /* =======================================================
     CRITERION 2 — NET DEBT / FCF
     ======================================================= */
  const latestFcf =
    valuationTtm?.ttm?.freeCashFlow ??
    lastData?.freeCashFlow ??
    null;
  const stockAnalysisNetDebt =
    stockAnalysisData?.balanceSheet
      ?.netDebt ?? null;
  const yahooNetDebt =
    lastData?.netDebt ?? null;
  const stockAnalysisNetDebtMillions =
    stockAnalysisNetDebt !== null
      ? stockAnalysisNetDebt /
        1_000_000
      : null;
  const netDebt =
    stockAnalysisNetDebtMillions ??
    yahooNetDebt;
  const netDebtToFcf =
    netDebt !== null &&
    latestFcf !== null &&
    latestFcf !== 0
      ? netDebt / latestFcf
      : null;
  const netDebtToFcfSubtitle =
    netDebt !== null &&
    latestFcf !== null &&
    lastYear !== null
      ? `${formatBillions(
          netDebt
        )} ÷ ${formatBillions(
          latestFcf
        )} (${valuationTtm?.ttm?.freeCashFlow != null
          ? "TTM"
          : lastYear})`
      : "Données insuffisantes";
  /* =======================================================
     CRITERION 3 — FCF CAGR
     ======================================================= */
  const fcfGrowth =
    firstData &&
    lastData &&
    firstYear !== null &&
    lastYear !== null
      ? calculateCagr(
          firstData.freeCashFlow,
          lastData.freeCashFlow,
          lastYear - firstYear
        )
      : null;
  /* =======================================================
     CRITERION 4 — DILUTED SHARES
     ======================================================= */
  const sharesGrowth =
    firstData && lastData
      ? calculateTotalChange(
          firstData.dilutedAverageShares,
          lastData.dilutedAverageShares
        )
      : null;
  /* =======================================================
     CRITERION 5 — SUPER ROIC
     ======================================================= */
  const historicalCompanyData =
    historicalData?.[company] ?? [];
  const superRoicCalculation =
    calculateFiveYearSuperRoic(
      historicalCompanyData
    );
  const superRoic =
    superRoicCalculation.average;
  const superRoicComplete =
    superRoicCalculation.completeYears ===
    5;
  const superRoicSubtitle =
    superRoicComplete
      ? "moyenne 2021 → 2025"
      : `${superRoicCalculation.completeYears}/5 années disponibles — 2021 → 2025`;
  /* =======================================================
     CRITERION 6 — FCF MARGIN
     ======================================================= */
  const fcfMargin =
    calculateAverageFcfMargin(
      criteriaYears
    );
  /* =======================================================
     CRITERIA LIST
     ======================================================= */
  const criteria: Criterion[] = [
    {
      id: "revenue-growth",
      title:
        "Croissance du chiffre d'affaires",
      subtitle:
        "par an sur les 5 dernières années, doit être supérieur à 10%",
      value: revenueGrowth,
      threshold: "> 10 %",
      passed:
        revenueGrowth === null
          ? null
          : revenueGrowth > 10,
    },
    {
      id: "fcf-growth",
      title:
        "Croissance du Free cash flow",
      subtitle:
        "par an sur les 5 dernières années, doit être supérieur à 10%",
      value: fcfGrowth,
      threshold: "> 10 %",
      passed:
        fcfGrowth === null
          ? null
          : fcfGrowth > 10,
    },
    {
      id: "super-roic",
      title: "Super ROIC",
      subtitle:
        "Super ROIC en moyenne sur 5 ans, doit être supérieur à 15%",
      value: superRoic,
      threshold: "> 15 %",
      passed:
        superRoic === null
          ? null
          : superRoic > 15,
      disabled: !superRoicComplete,
    },
    {
      id: "net-debt-fcf",
      title:
        "Dette nette / Free cash flow",
      subtitle:
        "au dernier trimestre, doit être inférieur à 3",
      value: netDebtToFcf,
      threshold: "< 3",
      passed:
        netDebtToFcf === null
          ? null
          : netDebtToFcf < 3,
    },
    {
      id: "shares-growth",
      title:
        "Nombre d'actions en circulation",
      subtitle:
        "sur les 5 dernières années, doit être inférieur ou égal à 0%",
      value: sharesGrowth,
      threshold: "≤ 0 %",
      passed:
        sharesGrowth === null
          ? null
          : sharesGrowth <= 0,
    },
    {
      id: "fcf-margin",
      title:
        "Marge du Free cash flow",
      subtitle:
        "en moyenne sur 5 ans, doit être supérieur à 10%",
      value: fcfMargin,
      threshold: "> 10 %",
      passed:
        fcfMargin === null
          ? null
          : fcfMargin > 10,
    },
  ];
  /* =======================================================
     DISPLAY HELPERS
     ======================================================= */
  function formatValue(
    value: number | null,
    criterionId: string
  ) {
    if (value === null) {
      return "—";
    }
    if (
      criterionId ===
      "net-debt-fcf"
    ) {
      return formatRatio(value);
    }
    return `${value.toFixed(2)} %`;
  }
  function getValueColor(
    criterion: Criterion
  ) {
    if (criterion.disabled) {
      return "text-[#aaa09d]";
    }
    if (criterion.passed === true) {
      return "text-[#667c5d]";
    }
    if (criterion.passed === false) {
      return "text-[#a76259]";
    }
    return "text-[#75666a]";
  }
  /* =======================================================
     LOADING
     ======================================================= */
  if (loading) {
    return (
      <section className="mt-8">
        <div className="rounded-2xl border border-[#d8d0cc] bg-white/60 p-8 text-center text-[#75666a]">
          Chargement des données
          fondamentales…
        </div>
      </section>
    );
  }
  /* =======================================================
     ERROR
     ======================================================= */
  if (error) {
    return (
      <section className="mt-8">
        <div className="rounded-2xl border border-[#d8b8b3] bg-[#faf4f3] p-6 text-[#97564e]">
          <div className="font-semibold">
            Impossible de charger les
            critères.
          </div>
          <div className="mt-2 text-sm">
            {error}
          </div>
        </div>
      </section>
    );
  }
  /* =======================================================
     RENDER
     ======================================================= */
  return (
    <section className="mt-8">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setCriteriaOpen(true)}
          className={`${unifraktur.className} relative inline-block text-[17px] text-slate-600 transition-colors duration-200 hover:text-[#6b1f1f] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[#6b1f1f] after:transition-all after:duration-300 hover:after:w-full`}
        >
          Critères d’investissement ✨
        </button>
      </div>
      {criteriaOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex h-screen w-screen items-center justify-center overflow-y-auto bg-black/25 px-6 py-8 backdrop-blur-[2px]"
          onClick={() => setCriteriaOpen(false)}
          role="presentation"
        >
          <div
            className="my-auto w-[min(1380px,calc(100vw-48px))] max-h-[calc(100vh-64px)] overflow-y-auto rounded-[26px] border border-[#ded6ca] bg-[#f3eee3]/95 p-5 shadow-[0_24px_80px_rgba(64,55,47,0.22)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Critères d’investissement — ${company}`}
          >
            <div
              className="mx-auto grid max-w-[1380px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
              style={{
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
              }}
            >
              {criteria.map((criterion) => {
                const clickable =
                  criterion.id === "revenue-growth" &&
                  !criterion.disabled;
                const unavailable =
                  criterion.value === null ||
                  !Number.isFinite(criterion.value);
                const classes = unavailable
                  ? "border-[#ded6ca] bg-[#fdfbf5]"
                  : criterion.passed
                    ? "border-[#b8d3bd] bg-[#eef7ef]"
                    : "border-[#dfb9b3] bg-[#faeeee]";
                const valueClasses = unavailable
                  ? "text-[#81766b]"
                  : criterion.passed
                    ? "text-[#315d3a]"
                    : "text-[#7b3834]";
                return (
                  <button
                    key={criterion.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (!clickable) {
                        return;
                      }
                      router.push(
                        `/graphes?company=${encodeURIComponent(
                          company
                        )}&criterion=${encodeURIComponent(
                          criterion.id
                        )}`
                      );
                    }}
                    className={`flex min-h-[175px] min-w-0 flex-col justify-between rounded-[20px] border px-5 py-6 text-center shadow-[0_8px_30px_rgba(84,68,48,0.05)] ${classes} ${
                      clickable
                        ? "cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <h2 className="w-full font-serif text-[18px] font-semibold tracking-[-0.01em] text-[#40372f]">
                      {criterion.title}
                    </h2>
                    <p className="mt-2 min-h-[34px] w-full text-[11px] leading-[17px] text-[#8f8377]">
                      {criterion.subtitle}
                    </p>
                    <p
                      className={`mt-4 w-full font-semibold leading-none tracking-[-0.035em] ${valueClasses}`}
                      style={{ fontSize: "26px" }}
                    >
                      {unavailable
                        ? "—"
                        : formatValue(
                            criterion.value,
                            criterion.id
                          )}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          </div>,
          document.body
        )}
    </section>
  );
}
