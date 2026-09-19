"use client";

import localFont from "next/font/local";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const unifraktur = localFont({
  src: "../app/fonts/UnifrakturMaguntia-Book.ttf",
  display: "swap",
});

type AnnualFundamental = {
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

type Criterion = {
  id: number;
  title: string;
};

type InvestmentCriteriaProps = {
  company: string;
  symbol: string;
};

export default function InvestmentCriteria({
  company,
  symbol,
}: InvestmentCriteriaProps) {
  const router = useRouter();

  const [data, setData] = useState<AnnualFundamental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch("/api/test-fundamentals");

        if (!response.ok) {
          throw new Error("Erreur API");
        }

        const result = await response.json();

        const companyData =
          result[company] ??
          result.LVMH ??
          result["Hermès"] ??
          [];

        setData(companyData);
      } catch (err) {
        console.error("Erreur récupération critères :", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [company]);

  const criteria: Criterion[] = [
    {
      id: 1,
      title:
        "Croissance du chiffre d'affaires (par an sur les 5 dernières années - Doit être supérieur à 10%)",
    },
    {
      id: 2,
      title:
        "Dette nette / Free cash flow (au dernier trimestre - doit être inférieur à 3)",
    },
    {
      id: 3,
      title:
        "Croissance du free cash flow (par an sur les 5 dernières années - doit être supérieur à 10 %)",
    },
    {
      id: 4,
      title:
        "Nombre d'actions en circulation (sur les 5 dernières années - doit être inférieur ou égal à 0 %)",
    },
    {
      id: 5,
      title:
        "Super ROIC (en moyenne sur 5 ans - doit être supérieur à 15 %)",
    },
    {
      id: 6,
      title:
        "Marge du free cash flow (en moyenne sur 5 ans - doit être supérieur à 10 %)",
    },
  ];

  function renderTitle(title: string) {
    const openingParenthesis = title.indexOf("(");

    if (openingParenthesis === -1) {
      return {
        mainTitle: title,
        parentheticalText: "",
      };
    }

    return {
      mainTitle: title.slice(0, openingParenthesis).trim(),
      parentheticalText: title.slice(openingParenthesis),
    };
  }

  function calculateCagr(
    startValue: number | null,
    endValue: number | null,
    years: number
  ) {
    if (
      startValue === null ||
      endValue === null ||
      startValue <= 0 ||
      endValue <= 0
    ) {
      return null;
    }

    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  }

  function calculateAverage(values: number[]) {
    if (values.length === 0) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function getCriterionResult(id: number) {
    if (data.length < 2) {
      return {
        value: null,
        passed: null,
      };
    }

    const sortedData = [...data].sort((a, b) => a.year - b.year);

    // ------------------------------------------------------------
    // 1. Croissance du chiffre d'affaires
    // ------------------------------------------------------------
    if (id === 1) {
      const first = sortedData[0];
      const last = sortedData[sortedData.length - 1];

      const growth = calculateCagr(
        first.revenue,
        last.revenue,
        sortedData.length - 1
      );

      return {
        value: growth,
        passed: growth !== null ? growth > 10 : null,
      };
    }

    // ------------------------------------------------------------
    // 2. Dette nette / Free Cash Flow
    //
    // IMPORTANT :
    // Le critère définitif doit utiliser le DERNIER TRIMESTRE.
    // Les données trimestrielles ne sont pas encore récupérées ici.
    // ------------------------------------------------------------
    if (id === 2) {
      const last = sortedData[sortedData.length - 1];

      if (
        last.totalDebt === null ||
        last.cashAndShortTermInvestments === null ||
        last.freeCashFlow === null ||
        last.freeCashFlow === 0
      ) {
        return {
          value: null,
          passed: null,
        };
      }

      const netDebt =
        last.totalDebt - last.cashAndShortTermInvestments;

      const ratio = netDebt / last.freeCashFlow;

      return {
        value: ratio,
        passed: ratio < 3,
      };
    }

    // ------------------------------------------------------------
    // 3. Croissance du Free Cash Flow
    // ------------------------------------------------------------
    if (id === 3) {
      const first = sortedData[0];
      const last = sortedData[sortedData.length - 1];

      const growth = calculateCagr(
        first.freeCashFlow,
        last.freeCashFlow,
        sortedData.length - 1
      );

      return {
        value: growth,
        passed: growth !== null ? growth > 10 : null,
      };
    }

    // ------------------------------------------------------------
    // 4. Nombre d'actions en circulation
    // ------------------------------------------------------------
    if (id === 4) {
      const first = sortedData[0];
      const last = sortedData[sortedData.length - 1];

      const growth = calculateCagr(
        first.dilutedAverageShares,
        last.dilutedAverageShares,
        sortedData.length - 1
      );

      return {
        value: growth,
        passed: growth !== null ? growth <= 0 : null,
      };
    }

    // ------------------------------------------------------------
    // 5. Super ROIC
    // ------------------------------------------------------------
    if (id === 5) {
      const roicValues = sortedData
        .map((item) => {
          if (
            item.operatingIncome === null ||
            item.taxProvision === null ||
            item.pretaxIncome === null ||
            item.stockholdersEquity === null ||
            item.totalDebt === null ||
            item.cashAndShortTermInvestments === null ||
            item.pretaxIncome === 0
          ) {
            return null;
          }

          const taxRate =
            item.taxProvision / item.pretaxIncome;

          const nopat =
            item.operatingIncome * (1 - taxRate);

          const netDebt =
            item.totalDebt -
            item.cashAndShortTermInvestments;

          const investedCapital =
            item.stockholdersEquity + netDebt;

          if (investedCapital === 0) {
            return null;
          }

          return (nopat / investedCapital) * 100;
        })
        .filter((value): value is number => value !== null);

      const average = calculateAverage(roicValues);

      return {
        value: average,
        passed: average !== null ? average > 15 : null,
      };
    }

    // ------------------------------------------------------------
    // 6. Marge du Free Cash Flow
    // ------------------------------------------------------------
    if (id === 6) {
      const margins = sortedData
        .map((item) => {
          if (
            item.freeCashFlow === null ||
            item.revenue === null ||
            item.revenue === 0
          ) {
            return null;
          }

          return (item.freeCashFlow / item.revenue) * 100;
        })
        .filter((value): value is number => value !== null);

      const average = calculateAverage(margins);

      return {
        value: average,
        passed: average !== null ? average > 10 : null,
      };
    }

    return {
      value: null,
      passed: null,
    };
  }

  if (loading) {
    return (
      <section className="mt-8">
        <h2
          className={`${unifraktur.className} mb-4 text-2xl font-normal leading-none text-slate-900`}
        >
          Critères d'investissement
        </h2>

        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
          Chargement des fondamentaux…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-8">
        <h2
          className={`${unifraktur.className} mb-4 text-2xl font-normal leading-none text-slate-900`}
        >
          Critères d'investissement
        </h2>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          Impossible de récupérer les fondamentaux.
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <h2
        className={`${unifraktur.className} mb-4 text-2xl font-normal leading-none text-slate-900`}
      >
        Critères d'investissement
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {criteria.map((criterion) => {
          const result = getCriterionResult(criterion.id);
          const titleParts = renderTitle(criterion.title);

          const cardClass =
            result.passed === true
              ? "border-green-200 bg-green-50"
              : result.passed === false
              ? "border-red-200 bg-red-50"
              : "border-slate-200 bg-slate-50";

          return (
            <div
              key={criterion.id}
              onClick={() => {
                if (criterion.id === 1) {
                  router.push(
                    `/graphes?company=${encodeURIComponent(
                      company
                    )}&criterion=revenue-growth`
                  );
                }
              }}
              className={`min-h-[125px] rounded-xl border p-4 shadow-sm transition ${
                criterion.id === 1
                  ? "cursor-pointer hover:shadow-md"
                  : ""
              } ${cardClass}`}
            >
              <h3 className="text-base font-semibold leading-snug text-slate-900">
                {titleParts.mainTitle}
              </h3>

              {result.value !== null && criterion.id !== 2 && (
                <div className="mt-3 text-4xl font-bold text-slate-900">
                  {result.value.toFixed(1)} %
                </div>
              )}

              {result.value !== null && criterion.id === 2 && (
                <div className="mt-3 text-4xl font-bold text-slate-900">
                  {result.value.toFixed(2)}
                </div>
              )}

              {titleParts.parentheticalText && (
                <div className="mt-2 text-xs font-normal italic leading-snug text-slate-600">
                  {titleParts.parentheticalText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}