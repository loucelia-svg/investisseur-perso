"use client";
import localFont from "next/font/local";
import { Suspense, useEffect, useMemo, useState } from "react";
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
function formatNumber(
  value: number | null,
  decimals = 0
): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
function formatMillions(
  value: number | null,
  decimals = 0
): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatNumber(value / 1_000_000, decimals)} M€`;
}
function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatNumber(value, 1)} %`;
}
function formatPerShare(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }
  return `${formatNumber(value, 2)} €`;
}
function calculateGrowth(
  current: number | null,
  previous: number | null
): number | null {
  if (
    current === null ||
    previous === null ||
    previous === 0 ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}
function calculateMargin(
  numerator: number | null,
  denominator: number | null
): number | null {
  if (
    numerator === null ||
    denominator === null ||
    denominator === 0 ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator)
  ) {
    return null;
  }
  return (numerator / denominator) * 100;
}
function calculateFcfPerShare(
  freeCashFlow: number | null,
  shares: number | null
): number | null {
  if (
    freeCashFlow === null ||
    shares === null ||
    shares === 0 ||
    !Number.isFinite(freeCashFlow) ||
    !Number.isFinite(shares)
  ) {
    return null;
  }
  const sharesInUnits =
    shares > 1_000_000
      ? shares
      : shares * 1_000_000;
  if (sharesInUnits === 0) {
    return null;
  }
  return freeCashFlow / sharesInUnits;
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
function sortHistory(
  rows: HistoricalFundamental[]
): HistoricalFundamental[] {
  return [...rows]
    .filter((row) => Number.isFinite(row.year))
    .sort((a, b) => a.year - b.year);
}
/* -------------------------------------------------------------------------- */
/* AXES */
/* -------------------------------------------------------------------------- */
function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalized = rawStep / magnitude;
  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}
function getNiceAxis(
  values: Array<number | null>,
  targetIntervals = 8
): {
  min: number;
  max: number;
  ticks: number[];
} {
  const finite = values.filter(
    (value): value is number =>
      value !== null && Number.isFinite(value)
  );
  if (finite.length === 0) {
    return { min: 0, max: 1, ticks: [1, 0] };
  }
  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  const rawMin = Math.min(0, dataMin);
  const rawMax = Math.max(0, dataMax);
  if (rawMin === rawMax) {
    const step = niceStep(Math.abs(rawMax || 1) / targetIntervals);
    const max = step * targetIntervals;
    return {
      min: 0,
      max,
      ticks: Array.from(
        { length: targetIntervals + 1 },
        (_, index) => max - index * step
      ),
    };
  }
  const step = niceStep((rawMax - rawMin) / targetIntervals);
  const min = rawMin < 0 ? Math.floor(rawMin / step) * step : 0;
  const max = rawMax > 0 ? Math.ceil(rawMax / step) * step : 0;
  const intervalCount = Math.round((max - min) / step);
  const ticks = Array.from(
    { length: intervalCount + 1 },
    (_, index) => {
      const value = max - index * step;
      return Math.abs(value) < step / 1_000_000 ? 0 : value;
    }
  );
  return { min, max, ticks };
}
function getXAxisYears(
  data: Array<{ year: number }>
): number[] {
  if (data.length <= 14) {
    return data.map((item) => item.year);
  }
  const targetLabels = 14;
  const step = Math.max(
    1,
    Math.ceil(
      (data.length - 1) /
        (targetLabels - 1)
    )
  );
  const years: number[] = [];
  for (
    let index = 0;
    index < data.length;
    index += step
  ) {
    years.push(data[index].year);
  }
  const lastYear =
    data[data.length - 1]?.year;
  if (
    lastYear !== undefined &&
    years[years.length - 1] !== lastYear
  ) {
    years.push(lastYear);
  }
  return years;
}
/* -------------------------------------------------------------------------- */
/* TOOLTIP */
/* -------------------------------------------------------------------------- */
function ChartTooltip({
  x,
  y,
  year,
  value,
  formatter,
}: {
  x: number;
  y: number;
  year: number;
  value: number;
  formatter: (value: number | null) => string;
}) {
  const tooltipWidth = 220;
  const tooltipHeight = 96;
  let left = x - tooltipWidth / 2;
  let top = y - tooltipHeight - 18;
  const maxLeft = 760 - tooltipWidth - 4;
  if (left < 4) {
    left = 4;
  }
  if (left > maxLeft) {
    left = maxLeft;
  }
  if (top < 4) {
    top = y + 18;
  }
  return (
    <g
      pointerEvents="none"
      style={{
        filter:
          "drop-shadow(0px 8px 18px rgba(65, 52, 40, 0.20))",
      }}
    >
      <rect
        x={left}
        y={top}
        width={tooltipWidth}
        height={tooltipHeight}
        rx="13"
        fill="#fffdf8"
        stroke="#d4c9bb"
        strokeWidth="1.6"
      />
      <text
        x={left + tooltipWidth / 2}
        y={top + 31}
        textAnchor="middle"
        fontSize="19"
        fontWeight="700"
        fontFamily="Georgia, serif"
        fill="#75695e"
      >
        {year}
      </text>
      <text
        x={left + tooltipWidth / 2}
        y={top + 72}
        textAnchor="middle"
        fontSize="36"
        fontWeight="700"
        fill="#40372f"
      >
        {formatter(value)}
      </text>
    </g>
  );
}
/* -------------------------------------------------------------------------- */
/* COURBE */
/* -------------------------------------------------------------------------- */
function PremiumLineChart({
  data,
  valueKey,
  percent = false,
  formatter,
}: {
  data: Array<{
    year: number;
    value: number | null;
  }>;
  valueKey: string;
  percent?: boolean;
  formatter: (
    value: number | null
  ) => string;
}) {
  const [hoveredIndex, setHoveredIndex] =
    useState<number | null>(null);
  const width = 760;
  const height = 300;
  const paddingLeft = 68;
  const paddingRight = 22;
  const paddingTop = 20;
  const paddingBottom = 42;
  const innerWidth =
    width -
    paddingLeft -
    paddingRight;
  const innerHeight =
    height -
    paddingTop -
    paddingBottom;
  const values = data.map(
    (item) => item.value
  );
  const axis = getNiceAxis(values);
  const minValue = axis.min;
  const maxValue = axis.max;
  const range =
    maxValue - minValue === 0
      ? 1
      : maxValue - minValue;
  const points = data
    .map((item, index) => {
      if (
        item.value === null ||
        !Number.isFinite(item.value)
      ) {
        return null;
      }
      const x =
        data.length <= 1
          ? paddingLeft +
            innerWidth / 2
          : paddingLeft +
            (index /
              (data.length - 1)) *
              innerWidth;
      const y =
        paddingTop +
        ((maxValue - item.value) /
          range) *
          innerHeight;
      return {
        x,
        y,
        year: item.year,
        value: item.value,
        index,
      };
    })
    .filter(
      (
        point
      ): point is {
        x: number;
        y: number;
        year: number;
        value: number;
        index: number;
      } => point !== null
    );
  if (points.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-stone-400">
        Données indisponibles
      </div>
    );
  }
  const linePath = points
    .map(
      (point, index) =>
        `${
          index === 0 ? "M" : "L"
        } ${point.x.toFixed(
          2
        )} ${point.y.toFixed(2)}`
    )
    .join(" ");
  const baselineY =
    paddingTop + innerHeight;
  const firstPoint = points[0];
  const lastPoint =
    points[points.length - 1];
  const areaPath =
    `${linePath} ` +
    `L ${lastPoint.x.toFixed(
      2
    )} ${baselineY.toFixed(2)} ` +
    `L ${firstPoint.x.toFixed(
      2
    )} ${baselineY.toFixed(2)} Z`;
  const gradientId = `premium-gradient-${valueKey}`;
  const gridValues = axis.ticks;
  const hoveredPoint =
    hoveredIndex === null
      ? null
      : points.find(
          (point) =>
            point.index ===
            hoveredIndex
        ) ?? null;
  const xAxisYears =
    getXAxisYears(data);
  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Graphique ${valueKey}`}
        onMouseLeave={() =>
          setHoveredIndex(null)
        }
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
              stopColor="#5b2a72"
              stopOpacity="0.30"
            />
            <stop
              offset="65%"
              stopColor="#7d4b92"
              stopOpacity="0.12"
            />
            <stop
              offset="100%"
              stopColor="#c9b2d4"
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>
        {gridValues.map((value) => {
          const y =
            paddingTop +
            ((maxValue - value) / range) *
              innerHeight;
          return (
            <g key={value}>
              <line
                x1={paddingLeft}
                x2={
                  width -
                  paddingRight
                }
                y1={y}
                y2={y}
                stroke="#d8d0c4"
                strokeWidth="1"
                strokeDasharray="2 5"
              />
              <text
                x={paddingLeft - 10}
                y={y + 7}
                textAnchor="end"
                fontSize="15"
                fontWeight="700"
                fill="#75695e"
              >
                {percent
                  ? formatPercent(value)
                  : formatter(value)}
              </text>
            </g>
          );
        })}
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
        />
        <path
          d={linePath}
          fill="none"
          stroke="#5b2a72"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <g
            key={`${point.year}-${point.index}`}
            onMouseEnter={() =>
              setHoveredIndex(
                point.index
              )
            }
          >
            <circle
              cx={point.x}
              cy={point.y}
              r="11"
              fill="transparent"
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={
                hoveredIndex ===
                point.index
                  ? 4.5
                  : 3.2
              }
              fill="#fdfbf5"
              stroke="#5b2a72"
              strokeWidth={
                hoveredIndex ===
                point.index
                  ? 2.2
                  : 1.8
              }
            />
          </g>
        ))}
        {xAxisYears.map((year) => {
          const index = data.findIndex(
            (item) =>
              item.year === year
          );
          if (index < 0) {
            return null;
          }
          const x =
            data.length <= 1
              ? paddingLeft +
                innerWidth / 2
              : paddingLeft +
                (index /
                  (data.length - 1)) *
                  innerWidth;
          return (
            <text
              key={year}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fontSize="17"
              fontWeight="700"
              fill="#75695e"
            >
              {year}
            </text>
          );
        })}
        {hoveredPoint && (
          <ChartTooltip
            x={hoveredPoint.x}
            y={hoveredPoint.y}
            year={hoveredPoint.year}
            value={hoveredPoint.value}
            formatter={formatter}
          />
        )}
      </svg>
    </div>
  );
}
/* -------------------------------------------------------------------------- */
/* BARRES */
/* -------------------------------------------------------------------------- */
function PremiumBarChart({
  data,
  formatter,
  valueKey,
}: {
  data: Array<{
    year: number;
    value: number | null;
  }>;
  formatter: (
    value: number | null
  ) => string;
  valueKey: string;
}) {
  const [hoveredIndex, setHoveredIndex] =
    useState<number | null>(null);
  const width = 760;
  const height = 300;
  const paddingLeft = 68;
  const paddingRight = 22;
  const paddingTop = 20;
  const paddingBottom = 42;
  const innerWidth =
    width -
    paddingLeft -
    paddingRight;
  const innerHeight =
    height -
    paddingTop -
    paddingBottom;
  const values = data.map(
    (item) => item.value
  );
  const axis = getNiceAxis(values);
  const maxValue = axis.max;
  const minValue = axis.min;
  const range =
    maxValue - minValue === 0
      ? 1
      : maxValue - minValue;
  const zeroY =
    paddingTop +
    ((maxValue - 0) / range) *
      innerHeight;
  const slotWidth =
    data.length > 0
      ? innerWidth / data.length
      : innerWidth;
  const barWidth = Math.min(
    52,
    slotWidth * 0.56
  );
  const xAxisYears =
    getXAxisYears(data);
  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Graphique ${valueKey}`}
        onMouseLeave={() =>
          setHoveredIndex(null)
        }
      >
        {axis.ticks.map((value) => {
          const y =
            paddingTop +
            ((maxValue - value) / range) *
              innerHeight;
          return (
            <g key={value}>
              <line
                x1={paddingLeft}
                x2={
                  width -
                  paddingRight
                }
                y1={y}
                y2={y}
                stroke="#d8d0c4"
                strokeWidth="1"
                strokeDasharray="2 5"
              />
              <text
                x={paddingLeft - 10}
                y={y + 7}
                textAnchor="end"
                fontSize="15"
                fontWeight="700"
                fill="#75695e"
              >
                {formatter(value)}
              </text>
            </g>
          );
        })}
        {data.map((item, index) => {
          if (
            item.value === null ||
            !Number.isFinite(item.value)
          ) {
            return null;
          }
          const xCenter =
            paddingLeft +
            slotWidth * index +
            slotWidth / 2;
          const valueY =
            paddingTop +
            ((maxValue - item.value) /
              range) *
              innerHeight;
          const y =
            item.value >= 0
              ? valueY
              : zeroY;
          const h = Math.abs(
            zeroY - valueY
          );
          const isHovered =
            hoveredIndex === index;
          return (
            <g
              key={item.year}
              onMouseEnter={() =>
                setHoveredIndex(index)
              }
            >
              <rect
                x={
                  xCenter -
                  barWidth / 2
                }
                y={y}
                width={barWidth}
                height={Math.max(h, 1)}
                rx="3"
                fill="#5b2a72"
                opacity={
                  isHovered
                    ? "1"
                    : "0.82"
                }
              />

            </g>
          );
        })}
        {hoveredIndex !== null &&
          (() => {
            const item = data[hoveredIndex];

            if (
              !item ||
              item.value === null ||
              !Number.isFinite(item.value)
            ) {
              return null;
            }

            const xCenter =
              paddingLeft +
              slotWidth * hoveredIndex +
              slotWidth / 2;

            const valueY =
              paddingTop +
              ((maxValue - item.value) / range) *
                innerHeight;

            const y =
              item.value >= 0
                ? valueY
                : zeroY;

            return (
              <ChartTooltip
                x={xCenter}
                y={y}
                year={item.year}
                value={item.value}
                formatter={formatter}
              />
            );
          })()}
        {xAxisYears.map((year) => {
          const index = data.findIndex(
            (item) =>
              item.year === year
          );
          if (index < 0) {
            return null;
          }
          const xCenter =
            paddingLeft +
            slotWidth * index +
            slotWidth / 2;
          return (
            <text
              key={year}
              x={xCenter}
              y={height - 8}
              textAnchor="middle"
              fontSize="17"
              fontWeight="700"
              fill="#75695e"
            >
              {year}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
/* -------------------------------------------------------------------------- */
/* CASH / DETTES */
/* -------------------------------------------------------------------------- */
function PremiumCashDebtChart({
  data,
}: {
  data: Array<{
    year: number;
    cash: number | null;
    debt: number | null;
  }>;
}) {
  const [hoveredIndex, setHoveredIndex] =
    useState<number | null>(null);
  const width = 760;
  const height = 300;
  const paddingLeft = 68;
  const paddingRight = 22;
  const paddingTop = 20;
  const paddingBottom = 42;
  const innerWidth =
    width -
    paddingLeft -
    paddingRight;
  const innerHeight =
    height -
    paddingTop -
    paddingBottom;
  const allValues = [
    ...data.map((item) => item.cash),
    ...data.map((item) => item.debt),
  ];
  const axis = getNiceAxis(allValues);
  const maxValue = axis.max;
  const slotWidth =
    data.length > 0
      ? innerWidth / data.length
      : innerWidth;
  const groupWidth = Math.min(
    68,
    slotWidth * 0.72
  );
  const barWidth = Math.max(
    8,
    (groupWidth - 7) / 2
  );
  const xAxisYears =
    getXAxisYears(data);
  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label="Graphique cash et dettes"
        onMouseLeave={() =>
          setHoveredIndex(null)
        }
      >
        {axis.ticks.map((value) => {
          const y =
            paddingTop +
            ((maxValue - value) / maxValue) *
              innerHeight;
          return (
            <g key={value}>
              <line
                x1={paddingLeft}
                x2={
                  width -
                  paddingRight
                }
                y1={y}
                y2={y}
                stroke="#d8d0c4"
                strokeWidth="1"
                strokeDasharray="2 5"
              />
              <text
                x={paddingLeft - 10}
                y={y + 7}
                textAnchor="end"
                fontSize="15"
                fontWeight="700"
                fill="#75695e"
              >
                {`${formatNumber(value, 0)} M€`}
              </text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const xCenter =
            paddingLeft +
            slotWidth * index +
            slotWidth / 2;
          const cashHeight =
            item.cash === null
              ? 0
              : (item.cash / maxValue) *
                innerHeight;
          const debtHeight =
            item.debt === null
              ? 0
              : (item.debt / maxValue) *
                innerHeight;
          const isHovered =
            hoveredIndex === index;
          return (
            <g
              key={item.year}
              onMouseEnter={() =>
                setHoveredIndex(index)
              }
            >
              <rect
                x={
                  xCenter -
                  groupWidth / 2
                }
                y={
                  paddingTop +
                  innerHeight -
                  cashHeight
                }
                width={barWidth}
                height={cashHeight}
                rx="3"
                fill="#5b2a72"
                opacity={
                  isHovered
                    ? "1"
                    : "0.82"
                }
              />
              <rect
                x={xCenter + 3}
                y={
                  paddingTop +
                  innerHeight -
                  debtHeight
                }
                width={barWidth}
                height={debtHeight}
                rx="3"
                fill="#b08a2e"
                opacity={
                  isHovered
                    ? "1"
                    : "0.86"
                }
              />

            </g>
          );
        })}
        {hoveredIndex !== null &&
          (() => {
            const item = data[hoveredIndex];

            if (!item) {
              return null;
            }

            const xCenter =
              paddingLeft +
              slotWidth * hoveredIndex +
              slotWidth / 2;

            const cashHeight =
              item.cash === null
                ? 0
                : (item.cash / maxValue) *
                  innerHeight;

            const debtHeight =
              item.debt === null
                ? 0
                : (item.debt / maxValue) *
                  innerHeight;

            return (
              <ChartTooltip
                x={xCenter}
                y={
                  paddingTop +
                  innerHeight -
                  Math.max(
                    cashHeight,
                    debtHeight
                  )
                }
                year={item.year}
                value={
                  Math.max(
                    item.cash ?? 0,
                    item.debt ?? 0
                  ) * 1_000_000
                }
                formatter={formatMillions}
              />
            );
          })()}
        {xAxisYears.map((year) => {
          const index = data.findIndex(
            (item) =>
              item.year === year
          );
          if (index < 0) {
            return null;
          }
          const xCenter =
            paddingLeft +
            slotWidth * index +
            slotWidth / 2;
          return (
            <text
              key={year}
              x={xCenter}
              y={height - 8}
              textAnchor="middle"
              fontSize="17"
              fontWeight="700"
              fill="#75695e"
            >
              {year}
            </text>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-center gap-6 text-[11px] text-stone-500">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#5b2a72]" />
          <span>Trésorerie</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#b08a2e]" />
          <span>Dette</span>
        </div>
      </div>
    </div>
  );
}
/* -------------------------------------------------------------------------- */
/* CARTES */
/* -------------------------------------------------------------------------- */
function GraphCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] p-5 shadow-[0_8px_30px_rgba(84,68,48,0.06)] sm:p-6">
      <div className="mb-4">
        <h2 className="font-serif text-[17px] font-semibold tracking-[-0.01em] text-[#40372f]">
          {title}
        </h2>
        <p className="mt-1 text-[11px] leading-5 text-[#9a8f83]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
/* -------------------------------------------------------------------------- */
/* PAGE */
/* -------------------------------------------------------------------------- */
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
      );
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
      className={`${gothicFont.variable} min-h-screen px-4 pb-20 text-[#40372f] sm:px-6 lg:px-10`}
      style={{
        backgroundColor: "#f3eee3",
        backgroundImage: 'url("/fond-graphiques.png")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "top center",
        backgroundSize: "100% auto",
        backgroundAttachment: "fixed",
      }}
    >
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
                        history[
                          history.length - 1
                        ]?.year
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
          <div className="rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] px-6 py-16 text-center shadow-[0_8px_30px_rgba(84,68,48,0.05)]">
            <p className="font-serif text-lg text-[#65594e]">
              Chargement de l&apos;historique…
            </p>
            <p className="mt-2 text-xs text-[#9a8f83]">
              Récupération des données
              financières.
            </p>
          </div>
        )}
        {!loading && error && (
          <div className="rounded-[22px] border border-[#d8c2b8] bg-[#fbf3ed] px-6 py-10 text-center">
            <p className="font-serif text-lg text-[#704f43]">
              Impossible de charger les
              données
            </p>
            <p className="mt-2 text-xs text-[#9a776b]">
              {error}
            </p>
          </div>
        )}
        {!loading &&
          !error &&
          history.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {/* RANGÉE 1 */}
                <GraphCard
                  title="Croissance du chiffre d'affaires"
                  description="Évolution annuelle du chiffre d'affaires"
                >
                  <PremiumBarChart
                    data={revenueGrowth}
                    valueKey="revenue-growth"
                    formatter={(value) =>
                      value === null
                        ? "—"
                        : `${formatNumber(
                            value,
                            0
                          )} M€`
                    }
                  />
                </GraphCard>
                <GraphCard
                  title="Free Cash Flow annuel"
                  description="Flux de trésorerie disponible généré chaque année"
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
                    valueKey="free-cash-flow"
                    formatter={(value) =>
                      value === null
                        ? "—"
                        : `${formatNumber(
                            value,
                            0
                          )} M€`
                    }
                  />
                </GraphCard>
                <GraphCard
                  title="Free Cash Flow par action"
                  description="Free Cash Flow rapporté au nombre d'actions diluées"
                >
                  <PremiumBarChart
                    data={fcfPerShare}
                    valueKey="fcf-per-share"
                    formatter={
                      formatPerShare
                    }
                  />
                </GraphCard>
                {/* RANGÉE 2 */}
                <GraphCard
                  title="Super ROIC"
                  description="(FCF − SBC) / (Total Assets − Goodwill − Current Liabilities)"
                >
                  <PremiumLineChart
                    data={superRoic}
                    valueKey="super-roic"
                    percent
                    formatter={formatPercent}
                  />
                </GraphCard>
                <GraphCard
                  title="Marge brute"
                  description="Résultat brut rapporté au chiffre d'affaires"
                >
                  <PremiumLineChart
                    data={grossMargin}
                    valueKey="gross-margin"
                    percent
                    formatter={formatPercent}
                  />
                </GraphCard>
                <GraphCard
                  title="Marge du Free Cash Flow"
                  description="Free Cash Flow rapporté au chiffre d'affaires"
                >
                  <PremiumLineChart
                    data={fcfMargin}
                    valueKey="fcf-margin"
                    percent
                    formatter={formatPercent}
                  />
                </GraphCard>
                {/* RANGÉE 3 */}
                <GraphCard
                  title="Actions en circulation diluées"
                  description="Évolution du nombre moyen d'actions diluées"
                >
                  <PremiumBarChart
                    data={history.map(
                      (row) => ({
                        year: row.year,
                        value:
                          row.dilutedShares ===
                          null
                            ? null
                            : row.dilutedShares /
                              1_000_000,
                      })
                    )}
                    valueKey="diluted-shares"
                    formatter={(value) =>
                      value === null
                        ? "—"
                        : `${formatNumber(
                            value,
                            1
                          )} M`
                    }
                  />
                </GraphCard>
                <GraphCard
                  title="Cash & dettes"
                  description="Évolution de la trésorerie et de la dette totale"
                >
                  <PremiumCashDebtChart
                    data={cashDebt}
                  />
                </GraphCard>
              </div>
            </>
          )}
        {!loading &&
          !error &&
          history.length === 0 && (
            <div className="rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] px-6 py-16 text-center">
              <p className="font-serif text-lg text-[#65594e]">
                Aucune donnée historique
                disponible.
              </p>
            </div>
          )}
        <footer className="mt-8 border-t border-[#d9d0c3] pt-5 text-[10px] leading-5 text-[#a0968a]">
          Données historiques financières.
          Les valeurs non disponibles restent
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
