"use client";

import localFont from "next/font/local";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";

const gothicFont = localFont({
  src: "../fonts/UnifrakturMaguntia-Book.ttf",
  variable: "--font-graphique",
  display: "swap",
});

type HistoricalFundamental = {
  year: number;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  freeCashFlow: number | null;
  unleveredFreeCashFlow: number | null;
  dilutedShares: number | null;
  totalDebt: number | null;
  cash: number | null;
  totalAssets: number | null;
  goodwill: number | null;
  currentLiabilities: number | null;
  stockBasedCompensation: number | null;
};

type HistoricalResponse = {
  LVMH: HistoricalFundamental[];
  Hermès: HistoricalFundamental[];
};

type Company = "LVMH" | "Hermès";

type ChartPoint = {
  year: number;
  value: number | null;
};

type CashDebtPoint = {
  year: number;
  cash: number | null;
  debt: number | null;
};

function formatNumber(
  value: number | null,
  decimals = 1
): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatPercent(
  value: number | null,
  decimals = 1
): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${formatNumber(value, decimals)} %`;
}

function sortHistory(
  rows: HistoricalFundamental[]
): HistoricalFundamental[] {
  return [...rows].sort(
    (a, b) => a.year - b.year
  );
}

function calculateMargin(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator === 0
  ) {
    return null;
  }

  return (numerator / denominator) * 100;
}

function calculateFcfPerShare(
  freeCashFlow: number | null,
  dilutedShares: number | null
): number | null {
  if (
    freeCashFlow === null ||
    dilutedShares === null ||
    !Number.isFinite(freeCashFlow) ||
    !Number.isFinite(dilutedShares) ||
    dilutedShares === 0
  ) {
    return null;
  }

  return freeCashFlow / dilutedShares;
}

/**
 * Super ROIC
 *
 * Formule exacte :
 *
 * (FCF - SBC)
 * -------------------------------
 * Total Assets - Goodwill - Current Liabilities
 *
 * Le résultat est exprimé en pourcentage.
 */
function calculateSuperRoic(
  freeCashFlow: number | null,
  stockBasedCompensation: number | null,
  totalAssets: number | null,
  goodwill: number | null,
  currentLiabilities: number | null
): number | null {
  if (
    freeCashFlow === null ||
    stockBasedCompensation === null ||
    totalAssets === null ||
    goodwill === null ||
    currentLiabilities === null
  ) {
    return null;
  }

  if (
    !Number.isFinite(freeCashFlow) ||
    !Number.isFinite(stockBasedCompensation) ||
    !Number.isFinite(totalAssets) ||
    !Number.isFinite(goodwill) ||
    !Number.isFinite(currentLiabilities)
  ) {
    return null;
  }

  const investedCapital =
    totalAssets -
    goodwill -
    currentLiabilities;

  if (
    !Number.isFinite(investedCapital) ||
    investedCapital === 0
  ) {
    return null;
  }

  return (
    ((freeCashFlow -
      stockBasedCompensation) /
      investedCapital) *
    100
  );
}

function PremiumLineChart({
  data,
  formatter = (value) =>
    formatNumber(value, 1),
  suffix = "",
}: {
  data: ChartPoint[];
  formatter?: (value: number) => string;
  suffix?: string;
}) {
  const valid = data.filter(
    (point) =>
      point.value !== null &&
      Number.isFinite(point.value)
  );

  if (valid.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-[#8d8278]">
        Données indisponibles
      </div>
    );
  }

  const width = 760;
  const height = 250;
  const paddingX = 28;
  const paddingTop = 24;
  const paddingBottom = 36;

  const values = valid.map(
    (point) => point.value as number
  );

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const range =
    maxValue - minValue === 0
      ? 1
      : maxValue - minValue;

  const points = valid.map(
    (point, index) => {
      const x =
        valid.length === 1
          ? width / 2
          : paddingX +
            (index /
              (valid.length - 1)) *
              (width - paddingX * 2);

      const y =
        paddingTop +
        ((maxValue -
          (point.value as number)) /
          range) *
          (height -
            paddingTop -
            paddingBottom);

      return {
        x,
        y,
        year: point.year,
        value: point.value as number,
      };
    }
  );

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath = `
    ${linePath}
    L ${points[points.length - 1].x} ${height - paddingBottom}
    L ${points[0].x} ${height - paddingBottom}
    Z
  `;

  const gradientId = `line-gradient-${Math.random()
    .toString(36)
    .slice(2)}`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[250px] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#4b2f62"
              stopOpacity="0.28"
            />
            <stop
              offset="100%"
              stopColor="#4b2f62"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((step) => {
          const y =
            paddingTop +
            (step / 3) *
              (height -
                paddingTop -
                paddingBottom);

          return (
            <line
              key={step}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="#d8d0c5"
              strokeWidth="1"
            />
          );
        })}

        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
        />

        <path
          d={linePath}
          fill="none"
          stroke="#4b2f62"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <g key={point.year}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#4b2f62"
            />

            <text
              x={point.x}
              y={height - 12}
              textAnchor="middle"
              fontSize="12"
              fill="#766b61"
            >
              {point.year}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-2 flex justify-between px-2 text-xs text-[#766b61]">
        <span>
          {formatter(
            Math.max(...values)
          )}
          {suffix}
        </span>
        <span>
          {formatter(
            Math.min(...values)
          )}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function PremiumBarChart({
  data,
  formatter = (value) =>
    formatNumber(value, 1),
  suffix = "",
}: {
  data: ChartPoint[];
  formatter?: (value: number) => string;
  suffix?: string;
}) {
  const valid = data.filter(
    (point) =>
      point.value !== null &&
      Number.isFinite(point.value)
  );

  if (valid.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-[#8d8278]">
        Données indisponibles
      </div>
    );
  }

  const values = valid.map(
    (point) => point.value as number
  );

  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 0);

  const range =
    maxValue - minValue === 0
      ? 1
      : maxValue - minValue;

  const width = 760;
  const height = 250;
  const paddingX = 28;
  const paddingTop = 20;
  const paddingBottom = 38;

  const chartHeight =
    height - paddingTop - paddingBottom;

  const zeroY =
    paddingTop +
    ((maxValue - 0) / range) *
      chartHeight;

  const barGap = 12;

  const availableWidth =
    width - paddingX * 2;

  const barWidth = Math.max(
    12,
    (availableWidth -
      barGap * (valid.length - 1)) /
      valid.length
  );

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[250px] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        <line
          x1={paddingX}
          x2={width - paddingX}
          y1={zeroY}
          y2={zeroY}
          stroke="#c9c0b5"
          strokeWidth="1.5"
        />

        {valid.map((point, index) => {
          const value =
            point.value as number;

          const x =
            paddingX +
            index *
              (barWidth + barGap);

          const valueY =
            paddingTop +
            ((maxValue - value) /
              range) *
              chartHeight;

          const y =
            value >= 0
              ? valueY
              : zeroY;

          const barHeight =
            Math.abs(zeroY - valueY);

          return (
            <g key={point.year}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(
                  1,
                  barHeight
                )}
                rx="5"
                fill="#4b2f62"
                opacity="0.9"
              />

              <text
                x={
                  x +
                  barWidth / 2
                }
                y={height - 12}
                textAnchor="middle"
                fontSize="12"
                fill="#766b61"
              >
                {point.year}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between px-2 text-xs text-[#766b61]">
        <span>
          {formatter(maxValue)}
          {suffix}
        </span>
        <span>
          {formatter(minValue)}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function PremiumCashDebtChart({
  data,
}: {
  data: CashDebtPoint[];
}) {
  const valid = data.filter(
    (point) =>
      (point.cash !== null &&
        Number.isFinite(point.cash)) ||
      (point.debt !== null &&
        Number.isFinite(point.debt))
  );

  if (valid.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-[#8d8278]">
        Données indisponibles
      </div>
    );
  }

  const allValues = valid.flatMap(
    (point) =>
      [
        point.cash,
        point.debt,
      ].filter(
        (value): value is number =>
          value !== null &&
          Number.isFinite(value)
      )
  );

  const maxValue = Math.max(
    ...allValues,
    1
  );

  const width = 760;
  const height = 250;
  const paddingX = 28;
  const paddingTop = 20;
  const paddingBottom = 38;
  const chartHeight =
    height - paddingTop - paddingBottom;

  const groupGap = 18;

  const availableWidth =
    width - paddingX * 2;

  const groupWidth =
    Math.max(
      18,
      (availableWidth -
        groupGap *
          (valid.length - 1)) /
        valid.length
    );

  const barWidth =
    Math.max(
      7,
      (groupWidth - 6) / 2
    );

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[250px] w-full overflow-visible"
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3].map(
          (step) => {
            const y =
              paddingTop +
              (step / 3) *
                chartHeight;

            return (
              <line
                key={step}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="#d8d0c5"
                strokeWidth="1"
              />
            );
          }
        )}

        {valid.map(
          (point, index) => {
            const groupX =
              paddingX +
              index *
                (groupWidth +
                  groupGap);

            const cash =
              point.cash ?? 0;

            const debt =
              point.debt ?? 0;

            const cashHeight =
              (cash / maxValue) *
              chartHeight;

            const debtHeight =
              (debt / maxValue) *
              chartHeight;

            const baseY =
              height -
              paddingBottom;

            return (
              <g key={point.year}>
                <rect
                  x={groupX}
                  y={
                    baseY -
                    cashHeight
                  }
                  width={barWidth}
                  height={Math.max(
                    1,
                    cashHeight
                  )}
                  rx="4"
                  fill="#4b2f62"
                />

                <rect
                  x={
                    groupX +
                    barWidth +
                    6
                  }
                  y={
                    baseY -
                    debtHeight
                  }
                  width={barWidth}
                  height={Math.max(
                    1,
                    debtHeight
                  )}
                  rx="4"
                  fill="#c7a743"
                />

                <text
                  x={
                    groupX +
                    groupWidth / 2
                  }
                  y={height - 12}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#766b61"
                >
                  {point.year}
                </text>
              </g>
            );
          }
        )}
      </svg>

      <div className="mt-3 flex items-center justify-center gap-5 text-xs text-[#766b61]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#4b2f62]" />
          <span>Cash</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#c7a743]" />
          <span>Dette</span>
        </div>
      </div>
    </div>
  );
}

function GraphCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#ddd4c8] bg-[#f8f4eb] p-5 shadow-[0_10px_35px_rgba(75,47,98,0.06)] sm:p-6">
      <div className="mb-4">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#40372f]">
          {title}
        </h2>

        {subtitle ? (
          <p className="mt-1 text-xs leading-5 text-[#8d8278]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function GraphiquesContent() {
  const searchParams = useSearchParams();

  const companyParam =
    searchParams.get("company");

  const company: Company =
    companyParam === "Hermès"
      ? "Hermès"
      : "LVMH";

  const [data, setData] =
    useState<HistoricalResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          "/api/historical-fundamentals?history=all",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Erreur HTTP ${response.status}`
          );
        }

        const json =
          (await response.json()) as HistoricalResponse;

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Impossible de charger les données."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const history = useMemo(() => {
    return sortHistory(
      data?.[company] ?? []
    );
  }, [data, company]);

  const revenueGrowth = useMemo(() => {
    return history.map((row) => ({
      year: row.year,
      value:
        row.revenue === null
          ? null
          : row.revenue / 1_000_000,
    }));
  }, [history]);

  const grossMargin = useMemo(() => {
    return history.map((row) => ({
      year: row.year,
      value: calculateMargin(
        row.grossProfit,
        row.revenue
      ),
    }));
  }, [history]);

  const fcfMargin = useMemo(() => {
    return history.map((row) => ({
      year: row.year,
      value: calculateMargin(
        row.freeCashFlow,
        row.revenue
      ),
    }));
  }, [history]);

  const fcfPerShare = useMemo(() => {
    return history.map((row) => ({
      year: row.year,
      value: calculateFcfPerShare(
        row.freeCashFlow,
        row.dilutedShares
      ),
    }));
  }, [history]);

  const superRoic = useMemo(() => {
    return history
      .map((row) => ({
        year: row.year,
        value: calculateSuperRoic(
          row.freeCashFlow,
          row.stockBasedCompensation,
          row.totalAssets,
          row.goodwill,
          row.currentLiabilities
        ),
      }))
      .filter(
        (row) =>
          row.value !== null &&
          Number.isFinite(row.value)
      )
      .slice(-5);
  }, [history]);

  const cashDebt = useMemo(() => {
    return history.map((row) => ({
      year: row.year,
      cash:
        row.cash === null
          ? null
          : row.cash / 1_000_000,
      debt:
        row.totalDebt === null
          ? null
          : row.totalDebt / 1_000_000,
    }));
  }, [history]);

  return (
    <main
      className={`${gothicFont.variable} min-h-screen bg-[#f3eee3] px-4 pb-20 text-[#40372f] sm:px-6 lg:px-10`}
    >
      <div className="mx-auto max-w-[1500px]">
        <header className="pt-10 pb-8 sm:pt-14 sm:pb-10">
          <div className="flex flex-col gap-3">
            <h1
              className="text-5xl leading-none text-[#4b2f62] sm:text-6xl"
              style={{
                fontFamily:
                  "var(--font-graphique)",
              }}
            >
              Graphiques
            </h1>

            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium tracking-wide text-[#6f6257]">
                Historique financier
              </p>

              <p className="text-xs text-[#9a8f84]">
                {history.length > 0
                  ? `${history[0].year} — ${
                      history[
                        history.length - 1
                      ].year
                    }`
                  : "—"}
              </p>
            </div>

            <div className="mt-3 inline-flex w-fit rounded-full border border-[#d8cec2] bg-[#eee8dc] px-4 py-2 text-xs font-medium text-[#5d5147]">
              {company}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-[28px] border border-[#ddd4c8] bg-[#f8f4eb] p-10 text-center text-sm text-[#8d8278]">
            Chargement des données historiques…
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-[#dfc8c8] bg-[#f8eeee] p-10 text-center text-sm text-[#8d5f5f]">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <GraphCard
              title="Croissance du chiffre d'affaires"
              subtitle="Chiffre d'affaires annuel, en millions d'euros."
            >
              <PremiumLineChart
                data={revenueGrowth}
                formatter={(value) =>
                  formatNumber(
                    value,
                    0
                  )
                }
                suffix=" M€"
              />
            </GraphCard>

            <GraphCard
              title="Free Cash Flow annuel"
              subtitle="Free Cash Flow annuel, en millions d'euros."
            >
              <PremiumBarChart
                data={history.map(
                  (row) => ({
                    year: row.year,
                    value:
                      row.freeCashFlow ===
                      null
                        ? null
                        : row.freeCashFlow /
                          1_000_000,
                  })
                )}
                formatter={(value) =>
                  formatNumber(
                    value,
                    0
                  )
                }
                suffix=" M€"
              />
            </GraphCard>

            <GraphCard
              title="Free Cash Flow par action"
              subtitle="Free Cash Flow rapporté au nombre d'actions diluées."
            >
              <PremiumLineChart
                data={fcfPerShare}
                formatter={(value) =>
                  formatNumber(
                    value,
                    2
                  )
                }
                suffix=" €"
              />
            </GraphCard>

            <GraphCard
              title="Super ROIC"
              subtitle="(FCF − SBC) / (Total Assets − Goodwill − Current Liabilities), sur les 5 dernières années."
            >
              <PremiumLineChart
                data={superRoic}
                formatter={(value) =>
                  formatNumber(
                    value,
                    1
                  )
                }
                suffix=" %"
              />
            </GraphCard>

            <GraphCard
              title="Marge brute"
              subtitle="Résultat brut rapporté au chiffre d'affaires."
            >
              <PremiumLineChart
                data={grossMargin}
                formatter={(value) =>
                  formatNumber(
                    value,
                    1
                  )
                }
                suffix=" %"
              />
            </GraphCard>

            <GraphCard
              title="Marge du Free Cash Flow"
              subtitle="Free Cash Flow rapporté au chiffre d'affaires."
            >
              <PremiumLineChart
                data={fcfMargin}
                formatter={(value) =>
                  formatNumber(
                    value,
                    1
                  )
                }
                suffix=" %"
              />
            </GraphCard>

            <GraphCard
              title="Actions en circulation diluées"
              subtitle="Nombre moyen d'actions diluées sur l'exercice."
            >
              <PremiumLineChart
                data={history.map(
                  (row) => ({
                    year: row.year,
                    value:
                      row.dilutedShares,
                  })
                )}
                formatter={(value) =>
                  formatNumber(
                    value,
                    1
                  )
                }
                suffix=" M"
              />
            </GraphCard>

            <GraphCard
              title="Cash & dettes"
              subtitle="Évolution annuelle du cash et de la dette totale, en millions d'euros."
            >
              <PremiumCashDebtChart
                data={cashDebt}
              />
            </GraphCard>
          </div>
        )}

        <footer className="pt-8 text-center text-xs text-[#9a8f84]">
          Données historiques financières. Les
          valeurs non disponibles restent
          indisponibles.
        </footer>
      </div>
    </main>
  );
}

export default function GraphiquesPage() {
  return (
    <Suspense fallback={null}>
      <GraphiquesContent />
    </Suspense>
  );
}