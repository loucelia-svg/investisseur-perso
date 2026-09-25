"use client";



import { useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";



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



  const [loading, setLoading] =

    useState(true);



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

        )} (${lastYear})`

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

        "par an sur les 5 dernières années, doit être supérieur à 10 %",

      value: revenueGrowth,

      threshold: "> 10 %",

      passed:

        revenueGrowth === null

          ? null

          : revenueGrowth > 10,

    },



    {

      id: "net-debt-fcf",

      title:

        "Dette nette / Free Cash Flow",

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

      id: "fcf-growth",

      title:

        "Croissance du Free Cash Flow",

      subtitle:

        "par an sur les 5 dernières années, doit être supérieur à 10 %",

      value: fcfGrowth,

      threshold: "> 10 %",

      passed:

        fcfGrowth === null

          ? null

          : fcfGrowth > 10,

    },



    {

      id: "shares-growth",

      title:

        "Nombre d'actions en circulation",

      subtitle:

        "sur les 5 dernières années, doit être inférieur ou égal à 0 %",

      value: sharesGrowth,

      threshold: "≤ 0 %",

      passed:

        sharesGrowth === null

          ? null

          : sharesGrowth <= 0,

    },



    {

      id: "super-roic",

      title: "Super ROIC",

      subtitle:

        "en moyenne sur 5 ans, doit être supérieur à 15 %",

      value: superRoic,

      threshold: "> 15 %",

      passed:

        superRoic === null

          ? null

          : superRoic > 15,

      disabled: !superRoicComplete,

    },



    {

      id: "fcf-margin",

      title:

        "Marge du Free Cash Flow",

      subtitle:

        "en moyenne sur 5 ans, doit être supérieur à 10 %",

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

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">

        {criteria.map(

          (criterion) => {

            const clickable =

              criterion.id ===

                "revenue-growth" &&

              !criterion.disabled;



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

                className={`

                  group

                  w-full

                  rounded-xl

                  border

                  px-5

                  py-4

                  text-left

                  transition-all

                  duration-200

                  ${

                    criterion.disabled

                      ? "cursor-default border-[#d2cbc8] bg-[#e9e5e3] opacity-60"

                      : criterion.passed ===

                          true

                        ? "cursor-default border-[#c7d2c1] bg-[#f5f8f3] hover:border-[#aebda7]"

                        : criterion.passed ===

                            false

                          ? "cursor-default border-[#dcc4c0] bg-[#faf5f4] hover:border-[#c9a29c]"

                          : "cursor-default border-[#d8d0cc] bg-white/65"

                  }

                  ${

                    clickable

                      ? "cursor-pointer hover:-translate-y-[1px] hover:shadow-sm"

                      : ""

                  }

                `}

              >

                <div className="flex items-center justify-between gap-6">

                  <div className="min-w-0 flex-1">

                    <div

                      className={`text-base font-medium ${

                        criterion.disabled

                          ? "text-[#8f8582]"

                          : "text-[#4b3940]"

                      }`}

                    >

                      {criterion.title}

                    </div>



                    <div

                      className={`mt-1 text-xs ${

                        criterion.disabled

                          ? "text-[#9b918e]"

                          : "text-[#88797e]"

                      }`}

                    >

                      {criterion.subtitle}

                    </div>



                    {criterion.disabled && (

                      <div className="mt-1 text-[11px] italic text-[#9b918e]">

                        Calcul momentanément

                        indisponible

                      </div>

                    )}

                  </div>



                  <div className="flex shrink-0 items-center gap-5">

                    <div className="text-right">

                      <div

                        className={`text-2xl font-semibold tracking-tight ${getValueColor(

                          criterion

                        )}`}

                      >

                        {formatValue(

                          criterion.value,

                          criterion.id

                        )}

                      </div>

                    </div>



                    {clickable && (

                      <div className="text-lg text-[#9b898f] transition-transform duration-200 group-hover:translate-x-1">

                        →

                      </div>

                    )}

                  </div>

                </div>

              </button>

            );

          }

        )}

      </div>

    </section>

  );

}