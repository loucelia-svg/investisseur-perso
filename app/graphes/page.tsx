"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type AnnualFundamental = {
  year: number;
  revenue: number | null;
};

export default function GraphiquesPage() {
  const searchParams = useSearchParams();

  const company = searchParams.get("company");
  const criterion = searchParams.get("criterion");

  const [fundamentals, setFundamentals] = useState<
    AnnualFundamental[]
  >([]);

  useEffect(() => {
    const fetchFundamentals = async () => {
      if (!company) return;

      const response = await fetch("/api/test-fundamentals");
      const data = await response.json();

      setFundamentals(data[company] ?? []);
    };

    fetchFundamentals();
  }, [company]);

  const revenueData = useMemo(() => {
    return [...fundamentals]
      .filter((item) => item.revenue !== null)
      .sort((a, b) => a.year - b.year);
  }, [fundamentals]);

  const maxRevenue =
    revenueData.length > 0
      ? Math.max(...revenueData.map((item) => item.revenue ?? 0))
      : 0;

  const minRevenue =
    revenueData.length > 0
      ? Math.min(...revenueData.map((item) => item.revenue ?? 0))
      : 0;

  const chartWidth = 900;
  const chartHeight = 400;
  const paddingLeft = 70;
  const paddingRight = 30;
  const paddingTop = 30;
  const paddingBottom = 60;

  const chartInnerWidth =
    chartWidth - paddingLeft - paddingRight;

  const chartInnerHeight =
    chartHeight - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (revenueData.length <= 1) {
      return paddingLeft + chartInnerWidth / 2;
    }

    return (
      paddingLeft +
      (index / (revenueData.length - 1)) *
        chartInnerWidth
    );
  };

  const getY = (revenue: number) => {
    if (maxRevenue === minRevenue) {
      return paddingTop + chartInnerHeight / 2;
    }

    return (
      paddingTop +
      ((maxRevenue - revenue) /
        (maxRevenue - minRevenue)) *
        chartInnerHeight
    );
  };

  const points = revenueData.map((item, index) => ({
    x: getX(index),
    y: getY(item.revenue ?? 0),
    year: item.year,
    revenue: item.revenue ?? 0,
  }));

  const linePoints = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const formatRevenue = (value: number) => {
    return `${(value / 1_000_000_000).toFixed(1)} Md€`;
  };

  const isRevenueGrowth =
    criterion === "revenue-growth";

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold text-slate-900">
          📊 Graphiques
        </h1>

        {company ? (
          <div className="mt-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {company}
            </h2>

            {isRevenueGrowth && (
              <p className="mt-1 text-slate-600">
                Croissance du chiffre d'affaires
              </p>
            )}

            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-800">
                Chiffre d'affaires annuel
              </h3>

              {revenueData.length > 0 ? (
                <>
                  <div className="mt-6 w-full overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                      className="min-w-[700px] w-full"
                      role="img"
                      aria-label={`Évolution du chiffre d'affaires de ${company}`}
                    >
                      {[0, 0.25, 0.5, 0.75, 1].map(
                        (position) => {
                          const y =
                            paddingTop +
                            position *
                              chartInnerHeight;

                          const value =
                            maxRevenue -
                            position *
                              (maxRevenue - minRevenue);

                          return (
                            <g key={position}>
                              <line
                                x1={paddingLeft}
                                x2={
                                  chartWidth -
                                  paddingRight
                                }
                                y1={y}
                                y2={y}
                                stroke="#e2e8f0"
                                strokeWidth="1"
                              />

                              <text
                                x={paddingLeft - 10}
                                y={y + 5}
                                textAnchor="end"
                                fontSize="12"
                                fill="#64748b"
                              >
                                {formatRevenue(value)}
                              </text>
                            </g>
                          );
                        }
                      )}

                      <polyline
                        points={linePoints}
                        fill="none"
                        stroke="#0f172a"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {points.map((point) => (
                        <g key={point.year}>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r="6"
                            fill="white"
                            stroke="#0f172a"
                            strokeWidth="3"
                          />

                          <text
                            x={point.x}
                            y={
                              chartHeight -
                              paddingBottom +
                              30
                            }
                            textAnchor="middle"
                            fontSize="13"
                            fontWeight="600"
                            fill="#475569"
                          >
                            {point.year}
                          </text>

                          <text
                            x={point.x}
                            y={point.y - 14}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="600"
                            fill="#0f172a"
                          >
                            {formatRevenue(
                              point.revenue
                            )}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  <div className="mt-4 rounded-lg bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">
                      Évolution annuelle du chiffre
                      d'affaires sur les exercices
                      disponibles.
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-6 text-slate-500">
                  Données indisponibles.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-slate-600">
              Sélectionnez un critère depuis la page
              principale.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}