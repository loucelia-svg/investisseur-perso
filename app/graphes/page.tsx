"use client";

import localFont from "next/font/local";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const unifraktur = localFont({
  src: "../fonts/UnifrakturMaguntia-Book.ttf",
  display: "swap",
});

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

type HistoricalResponse = {
  LVMH?: HistoricalFundamental[];
  Hermès?: HistoricalFundamental[];
};

type Company = "LVMH" | "Hermès";

const COMPANY_LABELS: Record<Company, string> = {
  LVMH: "LVMH",
  Hermès: "Hermès",
};

function formatNumber(value: number | null, decimals = 1) {
  if (value === null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatMillions(value: number | null, decimals = 1) {
  if (value === null || !Number.isFinite(value)) return "—";

  return `${formatNumber(value, decimals)} M€`;
}

function formatPercent(value: number | null, decimals = 1) {
  if (value === null || !Number.isFinite(value)) return "—";

  return `${formatNumber(value, decimals)} %`;
}

function calculateSuperRoic(item: HistoricalFundamental) {
  const {
    freeCashFlow,
    stockBasedCompensation,
    totalAssets,
    goodwill,
    currentLiabilities,
  } = item;

  if (
    freeCashFlow === null ||
    stockBasedCompensation === null ||
    totalAssets === null ||
    goodwill === null ||
    currentLiabilities === null
  ) {
    return null;
  }

  const investedCapital =
    totalAssets - goodwill - currentLiabilities;

  if (!Number.isFinite(investedCapital) || investedCapital === 0) {
    return null;
  }

  return (
    ((freeCashFlow - stockBasedCompensation) /
      investedCapital) *
    100
  );
}

function niceMax(values: number[]) {
  if (values.length === 0) return 100;

  const max = Math.max(...values);

  if (!Number.isFinite(max) || max <= 0) return 100;

  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalized = max / magnitude;

  let step = 1;

  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;

  return Math.ceil(normalized / step) * step * magnitude;
}

function niceMin(values: number[]) {
  if (values.length === 0) return 0;

  const min = Math.min(...values);

  if (!Number.isFinite(min)) return 0;

  if (min >= 0) return 0;

  const magnitude =
    10 ** Math.floor(Math.log10(Math.abs(min)));

  const normalized = Math.abs(min) / magnitude;

  let step = 1;

  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;

  return -Math.ceil(normalized / step) * step * magnitude;
}

function getXAxisYears(data: HistoricalFundamental[]) {
  if (data.length <= 14) {
    return data.map((item) => item.year);
  }

  const step = Math.ceil(data.length / 14);
  const years: number[] = [];

  for (let i = 0; i < data.length; i += step) {
    years.push(data[i].year);
  }

  const lastYear = data[data.length - 1]?.year;

  if (
    lastYear !== undefined &&
    years[years.length - 1] !== lastYear
  ) {
    years.push(lastYear);
  }

  return years;
}

function ChartTooltip({
  x,
  y,
  title,
  value,
}: {
  x: number;
  y: number;
  title: string;
  value: string;
}) {
  return (
    <g pointerEvents="none">
      <rect
        x={x - 70}
        y={y - 58}
        width="140"
        height="46"
        rx="10"
        fill="#40372f"
        opacity="0.96"
      />

      <text
        x={x}
        y={y - 38}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill="#fdfbf5"
      >
        {title}
      </text>

      <text
        x={x}
        y={y - 20}
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill="#fdfbf5"
      >
        {value}
      </text>
    </g>
  );
}

function PremiumLineChart({
  data,
  getValue,
  formatValue,
  zeroLine = false,
}: {
  data: HistoricalFundamental[];
  getValue: (item: HistoricalFundamental) => number | null;
  formatValue: (value: number) => string;
  zeroLine?: boolean;
}) {
  const width = 760;
  const height = 300;

  const paddingLeft = 68;
  const paddingRight = 22;
  const paddingTop = 20;
  const paddingBottom = 42;

  const chartWidth =
    width - paddingLeft - paddingRight;

  const chartHeight =
    height - paddingTop - paddingBottom;

  const values = data
    .map(getValue)
    .filter(
      (value): value is number =>
        value !== null && Number.isFinite(value)
    );

  if (values.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center font-serif text-sm text-[#8f8174]">
        Données indisponibles
      </div>
    );
  }

  let minValue = niceMin(values);
  let maxValue = niceMax(values);

  if (zeroLine) {
    minValue = Math.min(minValue, 0);
    maxValue = Math.max(maxValue, 0);
  }

  if (minValue === maxValue) {
    maxValue += 1;
    minValue -= 1;
  }

  const range = maxValue - minValue;

  const points = data
    .map((item, index) => {
      const value = getValue(item);

      if (value === null || !Number.isFinite(value)) {
        return null;
      }

      const x =
        paddingLeft +
        (index / Math.max(data.length - 1, 1)) *
          chartWidth;

      const y =
        paddingTop +
        ((maxValue - value) / range) *
          chartHeight;

      return {
        year: item.year,
        value,
        x,
        y,
      };
    })
    .filter(
      (
        point
      ): point is {
        year: number;
        value: number;
        x: number;
        y: number;
      } => point !== null
    );

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`
    )
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${
          height - paddingBottom
        } L ${points[0].x} ${
          height - paddingBottom
        } Z`
      : "";

  const xAxisYears = getXAxisYears(data);

  const [hoveredIndex, setHoveredIndex] =
    useState<number | null>(null);

  const hovered =
    hoveredIndex !== null
      ? points[hoveredIndex]
      : null;

  const yTicks = 5;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
      >
        <defs>
          <linearGradient
            id="purpleAreaGradient"
            x1="0"
            x2="0"
            y1="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#4c376b"
              stopOpacity="0.20"
            />
            <stop
              offset="100%"
              stopColor="#4c376b"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {Array.from({ length: yTicks + 1 }).map(
          (_, index) => {
            const ratio = index / yTicks;
            const y =
              paddingTop + ratio * chartHeight;

            const value =
              maxValue - ratio * range;

            return (
              <g key={index}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="#e6ded3"
                  strokeWidth="1"
                />

                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight="600"
                  fill="#8b7d70"
                >
                  {formatValue(value)}
                </text>
              </g>
            );
          }
        )}

        {zeroLine &&
          minValue < 0 &&
          maxValue > 0 && (
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={
                paddingTop +
                (maxValue / range) * chartHeight
              }
              y2={
                paddingTop +
                (maxValue / range) * chartHeight
              }
              stroke="#9d9185"
              strokeWidth="1.5"
              strokeDasharray="5 5"
            />
          )}

        {areaPath && (
          <path
            d={areaPath}
            fill="url(#purpleAreaGradient)"
          />
        )}

        <path
          d={linePath}
          fill="none"
          stroke="#4c376b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <circle
            key={`${point.year}-${index}`}
            cx={point.x}
            cy={point.y}
            r={hoveredIndex === index ? 6 : 3}
            fill="#4c376b"
            stroke="#fdfbf5"
            strokeWidth="2"
            onMouseEnter={() =>
              setHoveredIndex(index)
            }
            onMouseLeave={() =>
              setHoveredIndex(null)
            }
          />
        ))}

        {xAxisYears.map((year) => {
          const index = data.findIndex(
            (item) => item.year === year
          );

          if (index === -1) return null;

          const x =
            paddingLeft +
            (index / Math.max(data.length - 1, 1)) *
              chartWidth;

          return (
            <text
              key={year}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="21"
              fontWeight="700"
              fill="#75695e"
            >
              {year}
            </text>
          );
        })}

        {hovered && (
          <ChartTooltip
            x={hovered.x}
            y={hovered.y}
            title={`${hovered.year}`}
            value={formatValue(hovered.value)}
          />
        )}
      </svg>
    </div>
  );
}

function PremiumBarChart({
  data,
  getValue,
  formatValue,
}: {
  data: HistoricalFundamental[];
  getValue: (item: HistoricalFundamental) => number | null;
  formatValue: (value: number) => string;
}) {
  const width = 760;
  const height = 300;

  const paddingLeft = 68;
  const paddingRight = 22;
  const paddingTop = 20;
  const paddingBottom = 42;

  const chartWidth =
    width - paddingLeft - paddingRight;

  const chartHeight =
    height - paddingTop - paddingBottom;

  const values = data
    .map(getValue)
    .filter(
      (value): value is number =>
        value !== null && Number.isFinite(value)
    );

  if (values.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center font-serif text-sm text-[#8f8174]">
        Données indisponibles
      </div>
    );
  }

  const minValue = Math.min(0, niceMin(values));
  const maxValue = Math.max(0, niceMax(values));
  const range = maxValue - minValue || 1;

  const zeroY =
    paddingTop +
    ((maxValue - 0) / range) * chartHeight;

  const barWidth =
    (chartWidth / Math.max(data.length, 1)) *
    0.58;

  const xAxisYears = getXAxisYears(data);

  const [hoveredIndex, setHoveredIndex] =
    useState<number | null>(null);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
      >
        {Array.from({ length: 5 }).map(
          (_, index) => {
            const ratio = index / 4;

            const y =
              paddingTop + ratio * chartHeight;

            const value =
              maxValue - ratio * range;

            return (
              <g key={index}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="#e6ded3"
                  strokeWidth="1"
                />

                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight="600"
                  fill="#8b7d70"
                >
                  {formatValue(value)}
                </text>
              </g>
            );
          }
        )}

        {data.map((item, index) => {
          const value = getValue(item);

          if (
            value === null ||
            !Number.isFinite(value)
          ) {
            return null;
          }

          const x =
            paddingLeft +
            (index + 0.5) *
              (chartWidth / data.length) -
            barWidth / 2;

          const valueY =
            paddingTop +
            ((maxValue - value) / range) *
              chartHeight;

          const y = Math.min(valueY, zeroY);
          const h = Math.abs(zeroY - valueY);

          return (
            <rect
              key={`${item.year}-${index}`}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(h, 1)}
              rx="3"
              fill="#4c376b"
              opacity={
                hoveredIndex === index ? 1 : 0.82
              }
              onMouseEnter={() =>
                setHoveredIndex(index)
              }
              onMouseLeave={() =>
                setHoveredIndex(null)
              }
            />
          );
        })}

        <line
          x1={paddingLeft}
          x2={width - paddingRight}
          y1={zeroY}
          y2={zeroY}
          stroke="#9d9185"
          strokeWidth="1.5"
        />

        {xAxisYears.map((year) => {
          const index = data.findIndex(
            (item) => item.year === year
          );

          if (index === -1) return null;

          const x =
            paddingLeft +
            (index + 0.5) *
              (chartWidth / data.length);

          return (
            <text
              key={year}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="21"
              fontWeight="700"
              fill="#75695e"
            >
              {year}
            </text>
          );
        })}

        {hoveredIndex !== null &&
          data[hoveredIndex] &&
          (() => {
            const item = data[hoveredIndex];
            const value = getValue(item);

            if (
              value === null ||
              !Number.isFinite(value)
            ) {
              return null;
            }

            const x =
              paddingLeft +
              (hoveredIndex + 0.5) *
                (chartWidth / data.length);

            const valueY =
              paddingTop +
              ((maxValue - value) / range) *
                chartHeight;

            return (
              <ChartTooltip
                x={x}
                y={valueY}
                title={`${item.year}`}
                value={formatValue(value)}
              />
            );
          })()}
      </svg>
    </div>
  );
}

function PremiumCashDebtChart({
  data,
}: {
  data: HistoricalFundamental[];
}) {
  const width = 760;
  const height = 300;

  const paddingLeft = 68;
  const paddingRight = 22;
  const paddingTop = 20;
  const paddingBottom = 42;

  const chartWidth =
    width - paddingLeft - paddingRight;

  const chartHeight =
    height - paddingTop - paddingBottom;

  const cashValues = data
    .map(
      (item) =>
        item.cashAndShortTermInvestments ??
        item.cash
    )
    .filter(
      (value): value is number =>
        value !== null && Number.isFinite(value)
    );

  const debtValues = data
    .map((item) => item.totalDebt)
    .filter(
      (value): value is number =>
        value !== null && Number.isFinite(value)
    );

  const allValues = [...cashValues, ...debtValues];

  if (allValues.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center font-serif text-sm text-[#8f8174]">
        Données indisponibles
      </div>
    );
  }

  const maxValue = niceMax(allValues);
  const minValue = 0;
  const range = maxValue || 1;

  const barGroupWidth =
    chartWidth / Math.max(data.length, 1);

  const barWidth = barGroupWidth * 0.28;

  const xAxisYears = getXAxisYears(data);

  const [hovered, setHovered] = useState<{
    index: number;
    type: "cash" | "debt";
  } | null>(null);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
      >
        {Array.from({ length: 5 }).map(
          (_, index) => {
            const ratio = index / 4;

            const y =
              paddingTop + ratio * chartHeight;

            const value =
              maxValue - ratio * range;

            return (
              <g key={index}>
                <line
                  x1={paddingLeft}
                  x2={width - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="#e6ded3"
                  strokeWidth="1"
                />

                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fontWeight="600"
                  fill="#8b7d70"
                >
                  {formatMillions(value)}
                </text>
              </g>
            );
          }
        )}

        {data.map((item, index) => {
          const cash =
            item.cashAndShortTermInvestments ??
            item.cash;

          const debt = item.totalDebt;

          const center =
            paddingLeft +
            (index + 0.5) * barGroupWidth;

          const cashX =
            center - barWidth - 3;

          const debtX = center + 3;

          const cashHeight =
            cash !== null && Number.isFinite(cash)
              ? (cash / range) * chartHeight
              : 0;

          const debtHeight =
            debt !== null && Number.isFinite(debt)
              ? (debt / range) * chartHeight
              : 0;

          const cashY =
            paddingTop +
            chartHeight -
            cashHeight;

          const debtY =
            paddingTop +
            chartHeight -
            debtHeight;

          return (
            <g key={`${item.year}-${index}`}>
              {cash !== null &&
                Number.isFinite(cash) && (
                  <rect
                    x={cashX}
                    y={cashY}
                    width={barWidth}
                    height={Math.max(cashHeight, 1)}
                    rx="3"
                    fill="#4c376b"
                    opacity={
                      hovered?.index === index &&
                      hovered.type === "cash"
                        ? 1
                        : 0.82
                    }
                    onMouseEnter={() =>
                      setHovered({
                        index,
                        type: "cash",
                      })
                    }
                    onMouseLeave={() =>
                      setHovered(null)
                    }
                  />
                )}

              {debt !== null &&
                Number.isFinite(debt) && (
                  <rect
                    x={debtX}
                    y={debtY}
                    width={barWidth}
                    height={Math.max(debtHeight, 1)}
                    rx="3"
                    fill="#c5a43a"
                    opacity={
                      hovered?.index === index &&
                      hovered.type === "debt"
                        ? 1
                        : 0.82
                    }
                    onMouseEnter={() =>
                      setHovered({
                        index,
                        type: "debt",
                      })
                    }
                    onMouseLeave={() =>
                      setHovered(null)
                    }
                  />
                )}
            </g>
          );
        })}

        {xAxisYears.map((year) => {
          const index = data.findIndex(
            (item) => item.year === year
          );

          if (index === -1) return null;

          const x =
            paddingLeft +
            (index + 0.5) * barGroupWidth;

          return (
            <text
              key={year}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="21"
              fontWeight="700"
              fill="#75695e"
            >
              {year}
            </text>
          );
        })}

        {hovered &&
          (() => {
            const item = data[hovered.index];

            if (!item) return null;

            const value =
              hovered.type === "cash"
                ? item.cashAndShortTermInvestments ??
                  item.cash
                : item.totalDebt;

            if (
              value === null ||
              value === undefined ||
              !Number.isFinite(value)
            ) {
              return null;
            }

            const center =
              paddingLeft +
              (hovered.index + 0.5) *
                barGroupWidth;

            const barX =
              hovered.type === "cash"
                ? center - barWidth / 2
                : center + barWidth / 2;

            const valueY =
              paddingTop +
              chartHeight -
              (value / range) * chartHeight;

            return (
              <ChartTooltip
                x={barX}
                y={valueY}
                title={`${item.year} ${
                  hovered.type === "cash"
                    ? "Cash"
                    : "Dette"
                }`}
                value={formatMillions(value)}
              />
            );
          })()}
      </svg>

      <div className="mt-3 flex items-center justify-center gap-6 font-serif text-xs text-[#75695e]">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#4c376b]" />
          <span>Cash</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#c5a43a]" />
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
    <section className="rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] p-5 shadow-[0_8px_30px_rgba(84,68,48,0.06)] sm:p-6">
      <div className="mb-4">
        <h2
          className="text-[28px] leading-none tracking-[-0.02em] text-[#40372f]"
          style={{
            fontFamily: "var(--font-graphique)",
          }}
        >
          {title}
        </h2>

        {subtitle && (
          <p className="mt-2 font-serif text-xs leading-5 text-[#8b7d70]">
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function GraphiquesContent() {
  const searchParams = useSearchParams();

  const companyParam = searchParams.get("company");

  const company: Company =
    companyParam === "Hermès" ? "Hermès" : "LVMH";

  const [data, setData] =
    useState<HistoricalResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
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
            `Erreur ${response.status}`
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

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, []);

  const history = useMemo(
    () => data?.[company] ?? [],
    [data, company]
  );

  const revenueGrowth = useMemo(() => {
    return history.map((item, index) => {
      if (index === 0) {
        return {
          ...item,
          value: null,
        };
      }

      const previous = history[index - 1];

      if (
        item.revenue === null ||
        previous.revenue === null ||
        previous.revenue === 0
      ) {
        return {
          ...item,
          value: null,
        };
      }

      return {
        ...item,
        value:
          ((item.revenue - previous.revenue) /
            previous.revenue) *
          100,
      };
    });
  }, [history]);

  const fcfAnnual = useMemo(() => {
    return history.map((item) => ({
      ...item,
      value: item.freeCashFlow,
    }));
  }, [history]);

  const fcfPerShare = useMemo(() => {
    return history.map((item) => {
      if (
        item.freeCashFlow === null ||
        item.dilutedShares === null ||
        item.dilutedShares === 0
      ) {
        return {
          ...item,
          value: null,
        };
      }

      return {
        ...item,
        value:
          item.freeCashFlow /
          item.dilutedShares,
      };
    });
  }, [history]);

  const superRoic = useMemo(() => {
    return history.map((item) => ({
      ...item,
      value: calculateSuperRoic(item),
    }));
  }, [history]);

  const grossMargin = useMemo(() => {
    return history.map((item) => {
      if (
        item.revenue === null ||
        item.grossProfit === null ||
        item.revenue === 0
      ) {
        return {
          ...item,
          value: null,
        };
      }

      return {
        ...item,
        value:
          (item.grossProfit / item.revenue) *
          100,
      };
    });
  }, [history]);

  const fcfMargin = useMemo(() => {
    return history.map((item) => {
      if (
        item.revenue === null ||
        item.freeCashFlow === null ||
        item.revenue === 0
      ) {
        return {
          ...item,
          value: null,
        };
      }

      return {
        ...item,
        value:
          (item.freeCashFlow / item.revenue) *
          100,
      };
    });
  }, [history]);

  const dilutedShares = useMemo(() => {
    return history.map((item) => ({
      ...item,
      value: item.dilutedShares,
    }));
  }, [history]);

  return (
    <main className="min-h-screen bg-[#f4efe6] px-5 pb-16 text-[#40372f] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="pb-8 pt-10 sm:pb-10 sm:pt-14">
          <div className="flex items-end justify-between gap-8">
            <div className="flex items-end gap-8">
              <h1
                className="text-[48px] leading-none tracking-[-0.035em] text-[#40372f] sm:text-[58px]"
                style={{
                  fontFamily:
                    "var(--font-graphique)",
                }}
              >
                Graphiques
              </h1>

              {!loading &&
                !error &&
                history.length > 0 && (
                  <div className="pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8e80]">
                      Historique financier
                    </p>

                    <p className="mt-1 font-serif text-sm text-[#6f6358]">
                      {history[0]?.year} —{" "}
                      {
                        history[history.length - 1]
                          ?.year
                      }
                    </p>
                  </div>
                )}
            </div>

            <div className="pb-1 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8e80]">
                Entreprise
              </p>

              <p className="mt-1 font-serif text-lg font-semibold text-[#40372f]">
                {COMPANY_LABELS[company]}
              </p>
            </div>
          </div>

          <div className="mt-7 h-px bg-[#d9d0c3]" />
        </header>

        {loading && (
          <div className="rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] p-8 text-center font-serif text-sm text-[#8b7d70]">
            Chargement de l&apos;historique financier…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] p-8 text-center font-serif text-sm text-[#8b7d70]">
            Impossible de charger les données.

            <div className="mt-2 text-xs text-[#a3988d]">
              {error}
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          history.length > 0 && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <GraphCard
                title="Croissance du CA"
                subtitle="Évolution annuelle du chiffre d’affaires."
              >
                <PremiumBarChart
                  data={revenueGrowth}
                  getValue={(item) =>
                    "value" in item &&
                    typeof item.value === "number"
                      ? item.value
                      : null
                  }
                  formatValue={(value) =>
                    formatPercent(value)
                  }
                />
              </GraphCard>

              <GraphCard
                title="Free Cash Flow"
                subtitle="Free Cash Flow annuel."
              >
                <PremiumBarChart
                  data={fcfAnnual}
                  getValue={(item) =>
                    "value" in item &&
                    typeof item.value === "number"
                      ? item.value
                      : null
                  }
                  formatValue={(value) =>
                    formatMillions(value)
                  }
                />
              </GraphCard>

              <GraphCard
                title="FCF / action"
                subtitle="Free Cash Flow rapporté au nombre moyen d’actions diluées."
              >
                <PremiumBarChart
                  data={fcfPerShare}
                  getValue={(item) =>
                    "value" in item &&
                    typeof item.value === "number"
                      ? item.value
                      : null
                  }
                  formatValue={(value) =>
                    `${formatNumber(value, 2)} €`
                  }
                />
              </GraphCard>

              <GraphCard
                title="Super ROIC"
                subtitle="(FCF − SBC) / (Actifs totaux − Goodwill − Passifs courants)."
              >
                <PremiumLineChart
                  data={superRoic}
                  getValue={(item) =>
                    "value" in item &&
                    typeof item.value === "number"
                      ? item.value
                      : null
                  }
                  formatValue={(value) =>
                    formatPercent(value)
                  }
                  zeroLine
                />
              </GraphCard>

              <GraphCard
                title="Marge brute"
                subtitle="Résultat brut rapporté au chiffre d’affaires."
              >
                <PremiumLineChart
                  data={grossMargin}
                  getValue={(item) =>
                    "value" in item &&
                    typeof item.value === "number"
                      ? item.value
                      : null
                  }
                  formatValue={(value) =>
                    formatPercent(value)
                  }
                />
              </GraphCard>

              <GraphCard
                title="Marge FCF"
                subtitle="Free Cash Flow rapporté au chiffre d’affaires."
              >
                <PremiumLineChart
                  data={fcfMargin}
                  getValue={(item) =>
                    "value" in item &&
                    typeof item.value === "number"
                      ? item.value
                      : null
                  }
                  formatValue={(value) =>
                    formatPercent(value)
                  }
                />
              </GraphCard>

              <GraphCard
                title="Actions diluées"
                subtitle="Nombre moyen d’actions diluées."
              >
                <PremiumBarChart
                  data={dilutedShares}
                  getValue={(item) =>
                    "value" in item &&
                    typeof item.value === "number"
                      ? item.value
                      : null
                  }
                  formatValue={(value) =>
                    formatNumber(value, 0)
                  }
                />
              </GraphCard>

              <GraphCard
                title="Cash & Dette"
                subtitle="Évolution annuelle de la trésorerie et de la dette totale."
              >
                <PremiumCashDebtChart
                  data={history}
                />
              </GraphCard>
            </div>
          )}

        <footer className="pb-8 pt-10 text-center font-serif text-xs text-[#9b8e80]">
          Données financières historiques · Investisseur Perso
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