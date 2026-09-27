"use client";
import localFont from "next/font/local";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
type CompanySearchResult = {
  symbol: string;
  name: string;
  shortName: string | null;
  longName: string | null;
  exchange: string | null;
  quoteType: string | null;
};
type CompanySearchResponse = {
  success: boolean;
  results?: CompanySearchResult[];
  error?: string;
};
type CompanyFinancialsResponse = {
  success: boolean;
  symbol?: string;
  period?: { startYear: number; endYear: number; years: number[] };
  annual?: HistoricalFundamental[];
  latestQuarterlyBalanceSheet?: {
    totalDebt: number | null;
    cashAndShortTermInvestments: number | null;
    netDebt: number | null;
  };
  criteria?: {
    revenueGrowthCagr: number | null;
    netDebtToFCF: number | null;
    freeCashFlowGrowthCagr: number | null;
    dilutedSharesChange: number | null;
    superRoic: number | null;
    averageFcfMargin: number | null;
  };
  historicalSuperRoic?: Array<{ year: number; value: number | null }>;
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
type ValuationHistoryPoint = {
  year: number | string;
  date?: string;
  value: number;
};
type ValuationResponse = {
  success: boolean;
  company?: string;
  symbol?: string;
  currency?: string;
  currentPrice?: number | null;
  fcfPerShare?: {
    current: number | null;
    average5Years: number | null;
    average10Years: number | null;
  };
  growth?: {
    current: number | null;
    average5Years: number | null;
    average10Years: number | null;
  };
  pfcf?: {
    current: number | null;
    historicalAverage: number | null;
    average5Years: number | null;
    average10Years: number | null;
    median5Years?: number | null;
    median10Years?: number | null;
    history: Array<{ year: number; pfcf: number; pfcfExSbc: number | null }>;
    dailyHistory?: Array<{
      date: string;
      year: number;
      pfcf: number;
      pfcfExSbc: number | null;
    }>;
  };
  ps?: {
    current: number | null;
    historicalAverage: number | null;
    average5Years: number | null;
    average10Years: number | null;
    median5Years?: number | null;
    median10Years?: number | null;
    history: Array<{ year: number; ps: number }>;
    dailyHistory?: Array<{
      date: string;
      year: number;
      ps: number;
    }>;
  };
  pocf?: {
    current?: number | null;
    median5Years?: number | null;
    median10Years?: number | null;
    dailyHistory?: Array<{ date: string; year: number; pocf: number }>;
  };
  pe?: {
    current?: number | null;
    median5Years?: number | null;
    median10Years?: number | null;
    dailyHistory?: Array<{ date: string; year: number; pe: number }>;
  };
  ttm?: {
    revenue: number | null;
    freeCashFlow: number | null;
    stockBasedCompensation: number | null;
    dilutedShares: number | null;
    normalizedDilutedShares: number | null;
    freeCashFlowPerShare: number | null;
    adjustedFreeCashFlowPerShare: number | null;
    revenuePerShare: number | null;
    pfcf: number | null;
    pfcfExSbc: number | null;
    ps: number | null;
  };
  error?: string;
};
type CriterionCard = {
  title: string;
  subtitle: string;
  value: number | null;
  suffix: string;
  passed: boolean | null;
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
const LVMH_SBC_FALLBACK: Record<number, number> = {
  2024: 127_000_000,
  2025: 165_000_000,
};
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
function calculateAverageFcfMargin(
  rows: HistoricalFundamental[]
): number | null {
  const margins = rows
    .map((row) => {
      if (
        row.freeCashFlow === null ||
        row.revenue === null ||
        row.revenue <= 0
      ) {
        return null;
      }
      return (row.freeCashFlow / row.revenue) * 100;
    })
    .filter((value): value is number => value !== null);
  if (margins.length === 0) return null;
  return (
    margins.reduce((sum, value) => sum + value, 0) /
    margins.length
  );
}
function calculateCriteriaFromHistory(
  symbol: string,
  rows: HistoricalFundamental[],
  netDebt: number | null,
  latestExternalUfcf: number | null
) {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  // "5 dernières années" = évolution 2020 -> 2025 :
  // 6 points annuels séparés par 5 intervalles.
  const endYear = sorted.length > 0
    ? sorted[sorted.length - 1].year
    : null;
  const startYear = endYear === null ? null : endYear - 5;
  const criteriaRows =
    startYear === null
      ? []
      : sorted.filter(
          (row) =>
            row.year >= startYear &&
            row.year <= endYear!
        );
  const first =
    startYear === null
      ? null
      : criteriaRows.find((row) => row.year === startYear) ?? null;
  const last =
    endYear === null
      ? null
      : criteriaRows.find((row) => row.year === endYear) ?? null;
  const revenueGrowthCagr =
    first && last
      ? calculateCagr(first.revenue, last.revenue, 5)
      : null;
  const freeCashFlowGrowthCagr =
    first && last
      ? calculateCagr(first.freeCashFlow, last.freeCashFlow, 5)
      : null;
  const dilutedSharesChange =
    first && last
      ? calculateTotalChange(first.dilutedShares, last.dilutedShares)
      : null;
  const averageFcfMargin =
    calculateAverageFcfMargin(criteriaRows);
  // Le critère dette utilise le dernier UFCF annuel disponible,
  // conformément au moteur de référence de l'application.
  const latestHistoricalUfcf = [...criteriaRows]
    .reverse()
    .find(
      (row) =>
        row.unleveredFreeCashFlow !== null &&
        Number.isFinite(row.unleveredFreeCashFlow) &&
        row.unleveredFreeCashFlow > 0
    )?.unleveredFreeCashFlow ?? null;
  const latestUfcf =
    latestExternalUfcf !== null &&
    Number.isFinite(latestExternalUfcf) &&
    latestExternalUfcf > 0
      ? latestExternalUfcf
      : latestHistoricalUfcf;
  const netDebtToFCF =
    netDebt !== null &&
    latestUfcf !== null &&
    latestUfcf > 0
      ? netDebt / latestUfcf
      : null;
  // Super ROIC : moyenne stricte 2021 -> 2025 (5/5 années).
  const superRoicRows = sorted.filter(
    (row) => row.year >= 2021 && row.year <= 2025
  );
  const superRoicValues = superRoicRows.map((row) => {
    const sbc =
      row.stockBasedCompensation ??
      (symbol === "MC.PA"
        ? LVMH_SBC_FALLBACK[row.year] ?? null
        : null);
    return calculateSuperRoic(
      row.freeCashFlow,
      sbc,
      row.totalAssets,
      row.goodwill,
      row.currentLiabilities
    );
  });
  const validSuperRoic = superRoicValues.filter(
    (value): value is number =>
      value !== null && Number.isFinite(value)
  );
  const superRoic =
    superRoicRows.length === 5 &&
    validSuperRoic.length === 5
      ? validSuperRoic.reduce((sum, value) => sum + value, 0) / 5
      : null;
  return {
    startYear,
    endYear,
    revenueGrowthCagr,
    netDebtToFCF,
    freeCashFlowGrowthCagr,
    dilutedSharesChange,
    superRoic,
    averageFcfMargin,
  };
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
  data: Array<{ year: number | string }>
): Array<number | string> {
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
  const years: Array<number | string> = [];
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
function calculateSeriesGrowth(
  data: Array<{ value: number | null }>,
  index: number
): number | null {
  const current = data[index]?.value ?? null;
  if (current === null || !Number.isFinite(current)) return null;
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const previous = data[previousIndex]?.value ?? null;
    if (previous !== null && Number.isFinite(previous)) {
      return calculateGrowth(current, previous);
    }
  }
  return null;
}
function ChartTooltip({
  x,
  y,
  label,
  value,
  growth,
  formatter,
  compact = false,
}: {
  x: number;
  y: number;
  label: number | string;
  value: number;
  growth: number | null;
  formatter: (value: number | null) => string;
  compact?: boolean;
}) {
  const tooltipWidth = compact ? 176 : 230;
  const tooltipHeight =
    growth === null
      ? compact
        ? 70
        : 92
      : compact
        ? 98
        : 124;
  let left = x - tooltipWidth / 2;
  let top = y - tooltipHeight - 18;
  const maxLeft = 760 - tooltipWidth - 4;
  if (left < 4) left = 4;
  if (left > maxLeft) left = maxLeft;
  if (top < 4) top = y + 18;
  return (
    <g
      pointerEvents="none"
      style={{
        filter: "drop-shadow(0px 8px 18px rgba(65, 52, 40, 0.20))",
      }}
    >
      <rect
        x={left}
        y={top}
        width={tooltipWidth}
        height={tooltipHeight}
        rx={compact ? "10" : "13"}
        fill="#fffdf8"
        stroke="#d4c9bb"
        strokeWidth="1.6"
      />
      <text
        x={left + tooltipWidth / 2}
        y={top + (compact ? 23 : 29)}
        textAnchor="middle"
        fontSize={compact ? "15" : "19"}
        fontWeight="700"
        fontFamily="Georgia, serif"
        fill="#75695e"
      >
        {label}
      </text>
      <text
        x={left + tooltipWidth / 2}
        y={top + (compact ? 52 : 68)}
        textAnchor="middle"
        fontSize={compact ? "23" : "31"}
        fontWeight="700"
        fill="#40372f"
      >
        {formatter(value)}
      </text>
      {growth !== null && (
        <text
          x={left + tooltipWidth / 2}
          y={top + (compact ? 80 : 101)}
          textAnchor="middle"
          fontSize={compact ? "13" : "16"}
          fontWeight="700"
          fill="#75695e"
        >
          {`Croissance : ${growth >= 0 ? "+" : ""}${formatNumber(growth, 2)} %`}
        </text>
      )}
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
    year: number | string;
    date?: string;
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
  const isValuationMultiple =
    valueKey === "pfcf" ||
    valueKey === "pfcf-ex-sbc" ||
    valueKey === "price-to-sales" ||
    valueKey === "price-to-operating-cash-flow" ||
    valueKey === "price-to-earnings";
  const width = 760;
  const height = 300;
  const paddingLeft = 68;
  const paddingRight = 22;
  const paddingTop = 20;
  const paddingBottom = 42;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const validData = data.filter(
    (item): item is {
      year: number | string;
      date?: string;
      value: number;
    } =>
      item.value !== null &&
      Number.isFinite(item.value)
  );
  const values = validData.map((item) => item.value);
  const axis = getNiceAxis(values);
  const minValue = axis.min;
  const maxValue = axis.max;
  const range = maxValue - minValue === 0 ? 1 : maxValue - minValue;
  const points = validData.map((item, index) => {
    const x =
      validData.length <= 1
        ? paddingLeft + innerWidth / 2
        : paddingLeft +
          (index / (validData.length - 1)) * innerWidth;
    const y =
      paddingTop +
      ((maxValue - item.value) / range) * innerHeight;
    return {
      x,
      y,
      year: item.year,
      date: item.date,
      value: item.value,
      index,
    };
  });
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
        `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(" ");
  const baselineY = paddingTop + innerHeight;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath =
    `${linePath} ` +
    `L ${lastPoint.x.toFixed(2)} ${baselineY.toFixed(2)} ` +
    `L ${firstPoint.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;
  const gradientId = `premium-gradient-${valueKey}`;
  const gridValues = axis.ticks;
  const hoveredPoint =
    hoveredIndex === null ? null : points[hoveredIndex] ?? null;
  const isDatedSeries = validData.some((item) => Boolean(item.date));
  const formatExactDate = (date: string) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return date;
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    }).format(parsed);
  };
  const handleMouseMove = (
    event: React.MouseEvent<SVGSVGElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || points.length === 0) return;
    const svgX =
      ((event.clientX - rect.left) / rect.width) * width;
    const clampedX = Math.min(
      width - paddingRight,
      Math.max(paddingLeft, svgX)
    );
    const ratio = (clampedX - paddingLeft) / innerWidth;
    const index = Math.round(ratio * (points.length - 1));
    setHoveredIndex(
      Math.min(points.length - 1, Math.max(0, index))
    );
  };
  // Keep the X axis readable: years only, while the tooltip shows the exact date.
  const xLabels: Array<{ label: string; x: number }> = [];
  if (isDatedSeries) {
    const seen = new Set<number>();
    const years = validData
      .map((item) =>
        item.date ? new Date(`${item.date}T12:00:00Z`).getUTCFullYear() : null
      )
      .filter((year): year is number => year !== null && Number.isFinite(year));
    const uniqueYears = [...new Set(years)];
    const every = Math.max(1, Math.ceil(uniqueYears.length / 8));
    uniqueYears.forEach((year, yearIndex) => {
      if (yearIndex % every !== 0 && yearIndex !== uniqueYears.length - 1) return;
      const index = validData.findIndex(
        (item) =>
          item.date &&
          new Date(`${item.date}T12:00:00Z`).getUTCFullYear() === year
      );
      if (index >= 0 && !seen.has(index)) {
        seen.add(index);
        xLabels.push({ label: String(year), x: points[index].x });
      }
    });
  } else {
    const xAxisYears = getXAxisYears(validData);
    xAxisYears.forEach((year) => {
      const index = validData.findIndex((item) => item.year === year);
      if (index >= 0) {
        xLabels.push({ label: String(year), x: points[index].x });
      }
    });
  }
  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full overflow-visible cursor-crosshair"
        role="img"
        aria-label={`Graphique ${valueKey}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#5b2a72" stopOpacity="0.30" />
            <stop offset="65%" stopColor="#7d4b92" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#c9b2d4" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {gridValues.map((value) => {
          const y =
            paddingTop +
            ((maxValue - value) / range) * innerHeight;
          return (
            <g key={value}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
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
                {percent ? formatPercent(value) : formatter(value)}
              </text>
            </g>
          );
        })}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="#5b2a72"
          strokeWidth={isValuationMultiple ? "1.55" : "2.8"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {xLabels.map((item) => (
          <text
            key={`${item.label}-${item.x}`}
            x={item.x}
            y={height - 8}
            textAnchor="middle"
            fontSize="17"
            fontWeight="700"
            fill="#75695e"
          >
            {item.label}
          </text>
        ))}
        {hoveredPoint && (
          <>
            <line
              x1={hoveredPoint.x}
              x2={hoveredPoint.x}
              y1={paddingTop}
              y2={baselineY}
              stroke="#8f8377"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.5"
              pointerEvents="none"
            />
            <ChartTooltip
              x={hoveredPoint.x}
              y={hoveredPoint.y}
              label={
                hoveredPoint.date
                  ? formatExactDate(hoveredPoint.date)
                  : hoveredPoint.year
              }
              value={hoveredPoint.value}
              growth={
                isDatedSeries
                  ? null
                  : calculateSeriesGrowth(validData, hoveredPoint.index)
              }
              formatter={formatter}
              compact={isValuationMultiple}
            />
          </>
        )}
        <rect
          x={paddingLeft}
          y={paddingTop}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          pointerEvents="all"
        />
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
                growth={calculateSeriesGrowth(data, hoveredIndex)}
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
              (() => {
                const tooltipWidth = 250;
                const tooltipHeight = 154;
                let left = xCenter - tooltipWidth / 2;
                let top =
                  paddingTop +
                  innerHeight -
                  Math.max(cashHeight, debtHeight) -
                  tooltipHeight -
                  18;
                const maxLeft = width - tooltipWidth - 4;
                if (left < 4) left = 4;
                if (left > maxLeft) left = maxLeft;
                if (top < 4) {
                  top =
                    paddingTop +
                    innerHeight -
                    Math.max(cashHeight, debtHeight) +
                    18;
                }
                const previous = hoveredIndex > 0 ? data[hoveredIndex - 1] : null;
                const cashGrowth = calculateGrowth(item.cash, previous?.cash ?? null);
                const debtGrowth = calculateGrowth(item.debt, previous?.debt ?? null);
                return (
                  <g
                    pointerEvents="none"
                    style={{ filter: "drop-shadow(0px 8px 18px rgba(65, 52, 40, 0.20))" }}
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
                      y={top + 28}
                      textAnchor="middle"
                      fontSize="19"
                      fontWeight="700"
                      fontFamily="Georgia, serif"
                      fill="#75695e"
                    >
                      {item.year}
                    </text>
                    <text x={left + 18} y={top + 59} fontSize="16" fontWeight="700" fill="#5b2a72">
                      {`Trésorerie : ${item.cash === null ? "—" : `${formatNumber(item.cash, 0)} M€`}`}
                    </text>
                    <text x={left + 18} y={top + 82} fontSize="15" fontWeight="700" fill="#75695e">
                      {`Croissance : ${cashGrowth === null ? "—" : `${cashGrowth >= 0 ? "+" : ""}${formatNumber(cashGrowth, 2)} %`}`}
                    </text>
                    <text x={left + 18} y={top + 113} fontSize="16" fontWeight="700" fill="#b08a2e">
                      {`Dette : ${item.debt === null ? "—" : `${formatNumber(item.debt, 0)} M€`}`}
                    </text>
                    <text x={left + 18} y={top + 136} fontSize="15" fontWeight="700" fill="#75695e">
                      {`Croissance : ${debtGrowth === null ? "—" : `${debtGrowth >= 0 ? "+" : ""}${formatNumber(debtGrowth, 2)} %`}`}
                    </text>
                  </g>
                );
              })()
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
    <section className="min-w-0 overflow-hidden rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] p-5 shadow-[0_8px_30px_rgba(84,68,48,0.06)] sm:p-6">
      <div className="mb-4">
        <h2 className="font-serif text-[16px] font-semibold tracking-[-0.01em] text-[#40372f]">
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
function ValuationMultipleSummary({
  label,
  current,
  median5Years,
  median10Years,
}: {
  label: string;
  current: number | null | undefined;
  median5Years: number | null | undefined;
  median10Years: number | null | undefined;
}) {
  const difference = (
    medianValue: number | null | undefined
  ): number | null => {
    if (
      current === null ||
      current === undefined ||
      medianValue === null ||
      medianValue === undefined ||
      !Number.isFinite(current) ||
      !Number.isFinite(medianValue) ||
      medianValue <= 0
    ) {
      return null;
    }
    return ((current / medianValue) - 1) * 100;
  };
  const rows = [
    { label: "Sur 5 ans", median: median5Years },
    { label: "Sur 10 ans", median: median10Years },
  ];
  return (
    <div className="mt-4 border-t border-[#e2d9cd] pt-4">
      <p className="font-serif text-[13px] font-semibold text-[#40372f]">
        Le {label} actuel est de{" "}
        <span className="text-[#5b2a72]">
          {current === null ||
          current === undefined ||
          !Number.isFinite(current)
            ? "—"
            : formatNumber(current, 2)}
        </span>
      </p>
      <div className="mt-3 overflow-hidden rounded-[12px] border border-[#e2d9cd] bg-[#fffdf8]">
        <div className="grid grid-cols-[1fr_0.8fr_1.15fr] border-b border-[#e2d9cd] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#918579]">
          <span>Période</span>
          <span>Médiane</span>
          <span>Écart</span>
        </div>
        {rows.map((row, index) => {
          const gap = difference(row.median);
          const undervalued = gap !== null && gap < 0;
          const overvalued = gap !== null && gap > 0;
          const magnitude = gap === null ? null : Math.abs(gap);
          return (
            <div
              key={row.label}
              className={`grid grid-cols-[1fr_0.8fr_1.15fr] px-3 py-2 text-[11px] ${
                index === 0 ? "border-b border-[#eee7de]" : ""
              }`}
            >
              <span className="text-[#5f554c]">{row.label}</span>
              <span className="font-semibold text-[#40372f]">
                {row.median === null ||
                row.median === undefined ||
                !Number.isFinite(row.median)
                  ? "—"
                  : formatNumber(row.median, 2)}
              </span>
              <span
                className={`font-semibold ${
                  undervalued
                    ? "text-[#2f8a54]"
                    : overvalued
                      ? "text-[#b23a36]"
                      : "text-[#81766b]"
                }`}
              >
                {magnitude === null
                  ? "—"
                  : magnitude < 0.05
                    ? "À la médiane"
                    : `${formatNumber(magnitude, 1)}% ${
                        undervalued ? "sous-évalué" : "surévalué"
                      }`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ValuationNumberInput({
  value,
  onChange,
  suffix,
  step = 0.1,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  suffix: string;
  step?: number;
}) {
  return (
    <div className="mx-auto flex max-w-[185px] items-center rounded-[13px] border border-[#d8cdbc] bg-[#fffdf8] px-3 py-2 shadow-inner">
      <input
        type="number"
        value={
          value !== null && Number.isFinite(value)
            ? value
            : ""
        }
        step={step}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          const next = Number(raw);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="min-w-0 flex-1 bg-transparent text-center font-serif text-[17px] font-semibold text-[#40372f] outline-none"
      />
      <span className="ml-2 text-xs font-semibold text-[#918579]">{suffix}</span>
    </div>
  );
}
function ValuationSection({
  company,
  symbol,
}: {
  company: string;
  symbol: string;
}) {
  const [data, setData] = useState<ValuationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chosenFcfPerShare, setChosenFcfPerShare] = useState<number | null>(null);
  const [chosenGrowth, setChosenGrowth] = useState<number | null>(null);
  const [chosenPfcf, setChosenPfcf] = useState<number | null>(null);
  const [requiredReturn, setRequiredReturn] = useState<number | null>(null);
  const [removeSbc, setRemoveSbc] = useState(false);
  const [showPurchaseZones, setShowPurchaseZones] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setData(null);
      setShowPurchaseZones(false);
      try {
        const response = await fetch(
          `/api/valuation?company=${encodeURIComponent(company)}&symbol=${encodeURIComponent(symbol)}`,
          { cache: "no-store" }
        );
        const result = (await response.json()) as ValuationResponse;
        if (!response.ok || !result.success) {
          throw new Error(result.error ?? "Impossible de calculer la valorisation.");
        }
        if (cancelled) return;
        setData(result);
        setChosenFcfPerShare(null);
        setChosenGrowth(null);
        setChosenPfcf(null);
        setRequiredReturn(null);
        setRemoveSbc(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de calculer la valorisation.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [company, symbol]);
  const fairPrice = useMemo(() => {
    if (
      chosenFcfPerShare === null ||
      chosenGrowth === null ||
      chosenPfcf === null ||
      requiredReturn === null ||
      chosenFcfPerShare <= 0 ||
      chosenPfcf <= 0 ||
      requiredReturn <= -100 ||
      chosenGrowth <= -100
    ) {
      return null;
    }
    const futureFcfPerShare = chosenFcfPerShare * Math.pow(1 + chosenGrowth / 100, 10);
    const futurePrice = futureFcfPerShare * chosenPfcf;
    const result = futurePrice / Math.pow(1 + requiredReturn / 100, 10);
    return Number.isFinite(result) && result >= 0 ? result : null;
  }, [chosenFcfPerShare, chosenGrowth, chosenPfcf, requiredReturn]);
  const pfcfChart = useMemo<ValuationHistoryPoint[]>(() => {
    const daily = (data?.pfcf?.dailyHistory ?? [])
      .map((row) => ({
        year: row.year,
        date: row.date,
        value: removeSbc ? row.pfcfExSbc : row.pfcf,
      }))
      .filter(
        (row): row is {
          year: number;
          date: string;
          value: number;
        } =>
          row.value !== null &&
          Number.isFinite(row.value)
      );
    if (daily.length > 1) {
      return daily;
    }
    return (data?.pfcf?.history ?? [])
      .map((row) => ({
        year: row.year,
        value: removeSbc ? row.pfcfExSbc : row.pfcf,
      }))
      .filter(
        (row): row is { year: number; value: number } =>
          row.value !== null && Number.isFinite(row.value)
      );
  }, [data, removeSbc]);
  const psChart = useMemo<ValuationHistoryPoint[]>(() => {
    const daily = (data?.ps?.dailyHistory ?? [])
      .map((row) => ({
        year: row.year,
        date: row.date,
        value: row.ps,
      }))
      .filter((row) => Number.isFinite(row.value));
    if (daily.length > 1) {
      return daily;
    }
    return (data?.ps?.history ?? [])
      .map((row) => ({ year: row.year, value: row.ps }))
      .filter((row) => Number.isFinite(row.value));
  }, [data]);
  const pocfChart = useMemo<ValuationHistoryPoint[]>(() =>
    (data?.pocf?.dailyHistory ?? []).map((row) => ({
      year: row.year, date: row.date, value: row.pocf,
    })).filter((row) => Number.isFinite(row.value)), [data]);
  const peChart = useMemo<ValuationHistoryPoint[]>(() =>
    (data?.pe?.dailyHistory ?? []).map((row) => ({
      year: row.year, date: row.date, value: row.pe,
    })).filter((row) => Number.isFinite(row.value)), [data]);
  const purchaseZones = useMemo(() => {
    return Array.from({ length: 11 }, (_, index) => {
      const margin = index * 10;
      return {
        margin,
        price: fairPrice === null ? null : fairPrice * (1 - margin / 100),
      };
    });
  }, [fairPrice]);
  if (loading) {
    return (
      <section className="mt-14 rounded-[24px] border border-[#ded6ca] bg-[#fdfbf5] px-6 py-14 text-center shadow-[0_8px_30px_rgba(84,68,48,0.05)]">
        <p className="font-serif text-lg text-[#65594e]">Calcul de la valorisation…</p>
      </section>
    );
  }
  if (error || !data) {
    return (
      <section className="mt-14 rounded-[24px] border border-[#ded6ca] bg-[#fdfbf5] px-6 py-14 text-center shadow-[0_8px_30px_rgba(84,68,48,0.05)]">
        <p className="font-serif text-lg text-[#7b3834]">{error ?? "Valorisation indisponible."}</p>
      </section>
    );
  }
  const currency = data.currency ?? "EUR";
  const money = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value)
      ? "—"
      : `${formatNumber(value, 2)} €`;
  const percent = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value)
      ? "—"
      : `${formatNumber(value, 2)}%`;
  const multiple = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value)
      ? "—"
      : `${formatNumber(value, 2)}×`;
  return (
    <section className="pt-16">
      <header className="pb-8 sm:pb-10">
        <div className="flex items-end justify-between gap-8">
          <div>
            <h2
              className="text-[48px] leading-none tracking-[-0.035em] text-[#40372f] sm:text-[58px]"
              style={{ fontFamily: "var(--font-graphique)" }}
            >
              Valorisation
            </h2>
            <p className="mt-3 font-serif text-sm text-[#75695e]">
              Discounted Cash Flow · projection sur 10 ans du Free Cash Flow par action
            </p>
          </div>
          <div className="pb-1 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8e80]">Cours actuel</p>
            <p className="mt-1 font-serif text-lg font-semibold text-[#40372f]">{money(data.currentPrice)}</p>
          </div>
        </div>
        <div className="mt-7 h-px bg-[#d9d0c3]" />
      </header>
      <section className="mx-auto max-w-[1240px] rounded-[18px] border border-[#ded6ca] bg-[#fdfbf5] p-4 shadow-[0_8px_30px_rgba(84,68,48,0.06)] sm:p-4">
        <div className="mb-3">
          <h3 className="font-serif text-[19px] font-semibold text-[#40372f]">Discounted Cash Flow</h3>
          <p className="mt-1 text-[12px] text-[#9a8f83]">Projection sur 10 ans du Free Cash Flow par action</p>
        </div>
        <div
          className="grid items-stretch gap-4"
          style={{ gridTemplateColumns: "minmax(0, 1fr) 270px" }}
        >
          <div className="rounded-[16px] border border-[#ded6ca]">
            <table className="w-full table-fixed border-collapse bg-[#fffdf8] text-center">
              <colgroup>
                <col className="w-[29%]" />
                <col className="w-[13%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[26%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-[#ded6ca]">
                  <th className="w-[28%] border-r border-[#ded6ca] px-2.5 py-1.5" />
                  <th colSpan={3} className="border-r border-[#ded6ca] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#8f8377]">Historique</th>
                  <th className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#5b2a72]">Hypothèses</th>
                </tr>
                <tr className="border-b border-[#ded6ca]">
                  <th className="border-r border-[#ded6ca] px-2.5 py-1.5" />
                  <th className="border-r border-[#ded6ca] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#918579]">Actuel</th>
                  <th className="border-r border-[#ded6ca] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#918579]">Moyenne 5 ans</th>
                  <th className="border-r border-[#ded6ca] px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#918579]">Moyenne 10 ans</th>
                  <th className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#918579]">Valeur choisie</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#ded6ca]">
                  <td className="border-r border-[#ded6ca] px-4 py-3 text-left">
                    <p className="font-serif text-[14px] font-semibold text-[#40372f]">Free Cash Flow par action</p>
                    <p className="mt-1 text-[9px] text-[#9a8f83]">FCF ÷ actions diluées</p>
                  </td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{money(data.fcfPerShare?.current)}</td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{money(data.fcfPerShare?.average5Years)}</td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{money(data.fcfPerShare?.average10Years)}</td>
                  <td className="px-2.5 py-1.5"><ValuationNumberInput value={chosenFcfPerShare} onChange={setChosenFcfPerShare} suffix={currency} step={0.01} /></td>
                </tr>
                <tr className="border-b border-[#ded6ca]">
                  <td className="border-r border-[#ded6ca] px-4 py-3 text-left">
                    <p className="font-serif text-[14px] font-semibold text-[#40372f]">Taux de croissance</p>
                    <p className="mt-1 text-[9px] text-[#9a8f83]">Croissance annuelle du FCF par action</p>
                  </td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{percent(data.growth?.current)}</td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{percent(data.growth?.average5Years)}</td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{percent(data.growth?.average10Years)}</td>
                  <td className="px-2.5 py-1.5"><ValuationNumberInput value={chosenGrowth} onChange={setChosenGrowth} suffix="%" step={0.1} /></td>
                </tr>
                <tr>
                  <td className="border-r border-[#ded6ca] px-4 py-3 text-left">
                    <p className="font-serif text-[14px] font-semibold text-[#40372f]">Ratio P/FCF</p>
                    <p className="mt-1 text-[9px] text-[#9a8f83]">Prix ÷ Free Cash Flow par action</p>
                  </td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{multiple(data.pfcf?.current)}</td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{multiple(data.pfcf?.average5Years)}</td>
                  <td className="border-r border-[#ded6ca] px-3 py-3 font-serif text-[14px] font-semibold">{multiple(data.pfcf?.average10Years)}</td>
                  <td className="px-2.5 py-1.5"><ValuationNumberInput value={chosenPfcf} onChange={setChosenPfcf} suffix="×" step={0.1} /></td>
                </tr>
              </tbody>
            </table>
          </div>
          <aside className="flex h-full min-h-[230px] flex-col rounded-[16px] border border-[#ded6ca] bg-[#fffdf8] px-4 py-4 text-center">
            <div className="flex flex-1 flex-col justify-center">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#918579]">Rendement exigé</p>
              <div className="mt-3"><ValuationNumberInput value={requiredReturn} onChange={setRequiredReturn} suffix="%" step={0.1} /></div>
              <p className="mx-auto mt-3 max-w-[210px] text-[9px] leading-4 text-[#9a8f83]">Rendement annuel utilisé pour actualiser le prix estimé dans 10 ans.</p>
            </div>
            <div className="flex flex-1 flex-col justify-center border-t border-[#ded6ca] pt-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#918579]">Prix juste estimé</p>
              <p className="mt-3 font-serif text-[29px] font-semibold tracking-[-0.04em] text-[#5b2a72]">{money(fairPrice)}</p>
              <p className="mt-2 text-[9px] uppercase tracking-[0.16em] text-[#a0968a]">Projection sur 10 ans</p>
              {fairPrice !== null && (
                <div className="mt-3 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowPurchaseZones(true)}
                    className="relative w-fit flex-none border-0 bg-transparent p-0 text-[17px] text-slate-600 transition-colors duration-200 hover:text-[#6b1f1f] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[#6b1f1f] after:transition-all after:duration-300 hover:after:w-full"
                    style={{ fontFamily: "var(--font-graphique)" }}
                  >
                    Voir les zones d'achat
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
      <div className="mx-auto mt-6 grid max-w-[1180px] grid-cols-1 gap-4 lg:grid-cols-2">
        <GraphCard title="Prix / Free Cash Flow" description="Évolution historique du multiple de Free Cash Flow">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setRemoveSbc((value) => !value)}
              className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${removeSbc ? "border-[#5b2a72] bg-[#efe5f3] text-[#5b2a72]" : "border-[#d8cdbc] bg-[#fffdf8] text-[#81766b]"}`}
              aria-pressed={removeSbc}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${removeSbc ? "bg-[#5b2a72]" : "bg-[#c9bfb3]"}`} />
              Retirer les SBC
            </button>
          </div>
          <PremiumLineChart data={pfcfChart} valueKey={removeSbc ? "pfcf-ex-sbc" : "pfcf"} formatter={(value) => value === null ? "—" : formatNumber(value, 2)} axisFormatter={(value) => formatNumber(value, 2)} chartHeight={245} />
          <ValuationMultipleSummary label="P/FCF" current={data.pfcf?.current} median5Years={data.pfcf?.median5Years} median10Years={data.pfcf?.median10Years} />
        </GraphCard>
        <GraphCard title="Prix / Chiffre d'affaires" description="Évolution historique du multiple Prix / Chiffre d'affaires">
          <PremiumLineChart data={psChart} valueKey="price-to-sales" formatter={(value) => value === null ? "—" : formatNumber(value, 2)} axisFormatter={(value) => formatNumber(value, 2)} chartHeight={245} />
          <ValuationMultipleSummary label="P/S" current={data.ps?.current} median5Years={data.ps?.median5Years} median10Years={data.ps?.median10Years} />
        </GraphCard>
      </div>
      <div className="mx-auto mt-4 grid max-w-[1180px] grid-cols-1 gap-4 lg:grid-cols-2">
        <GraphCard title="Prix / Cash-flow opérationnel" description="Évolution historique du multiple Prix / Cash-flow opérationnel">
          <PremiumLineChart data={pocfChart} valueKey="price-to-operating-cash-flow" formatter={(value) => value === null ? "—" : formatNumber(value, 2)} axisFormatter={(value) => formatNumber(value, 2)} chartHeight={245} />
          <ValuationMultipleSummary label="P/OCF" current={data.pocf?.current} median5Years={data.pocf?.median5Years} median10Years={data.pocf?.median10Years} />
        </GraphCard>
        <GraphCard title="Prix / Bénéfice net" description="Évolution historique du multiple Prix / Bénéfice net">
          <PremiumLineChart data={peChart} valueKey="price-to-earnings" formatter={(value) => value === null ? "—" : formatNumber(value, 2)} axisFormatter={(value) => formatNumber(value, 2)} chartHeight={245} />
          <ValuationMultipleSummary label="P/E" current={data.pe?.current} median5Years={data.pe?.median5Years} median10Years={data.pe?.median10Years} />
        </GraphCard>
      </div>
      {showPurchaseZones && fairPrice !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#2d251f]/30 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowPurchaseZones(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-zones-title"
            className="w-[min(94vw,1040px)] rounded-[22px] border border-[#d8cdbc] bg-[#fffdf8] p-6 shadow-[0_20px_65px_rgba(56,42,31,0.20)]"
          >
            <div className="flex items-start">
              <div>
                <h3
                  id="purchase-zones-title"
                  className="font-serif text-[22px] font-semibold tracking-[-0.02em] text-[#40372f]"
                >
                  Marge de sécurité et Zones d'achat
                </h3>
                <p className="mt-1 text-[10px] text-[#918579]">
                  Prix juste estimé · {money(fairPrice)}
                </p>
              </div>
            </div>
            <div className="mt-4 px-1">
              <div className="flex h-[230px] items-end justify-between gap-5 border-b border-[#d8d0c4]">
                {purchaseZones.map((zone) => {
                  const maxPrice = fairPrice;
                  const height =
                    zone.price === null || maxPrice <= 0
                      ? 0
                      : Math.max(2, (zone.price / maxPrice) * 172);
                  return (
                    <div
                      key={zone.margin}
                      className="flex min-w-0 flex-1 flex-col items-center justify-end"
                    >
                      <span
                        className="mb-2 whitespace-nowrap font-serif text-[12px] font-semibold text-[#5b2a72]"
                      >
                        {zone.price === null
                          ? "—"
                          : `${formatNumber(zone.price, 0)}\u00A0€`}
                      </span>
                      <div
                        className="w-full max-w-[42px] rounded-t-[5px] bg-[#5b2a72]"
                        style={{ height }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between gap-3">
                {purchaseZones.map((zone) => (
                  <span
                    key={zone.margin}
                    className="min-w-0 flex-1 text-center text-[10px] font-semibold text-[#5b2a72]"
                  >
                    {zone.margin === 0 ? "0%" : `−${zone.margin}%`}
                  </span>
                ))}
              </div>
            </div>
            {data.currentPrice !== null &&
              data.currentPrice !== undefined && (
                <p className="mt-3 text-center font-serif text-[10px] text-[#8b6b22]">
                  Cours actuel : {money(data.currentPrice)}
                </p>
              )}
          </section>
        </div>
      )}
    </section>
  );
}
/* -------------------------------------------------------------------------- */
/* PAGE */
function CriterionCardView({ card }: { card: CriterionCard }) {
  const unavailable = card.value === null || !Number.isFinite(card.value);
  const classes = unavailable
    ? "border-[#ded6ca] bg-[#fdfbf5]"
    : card.passed
      ? "border-[#b8d3bd] bg-[#eef7ef]"
      : "border-[#dfb9b3] bg-[#faeeee]";
  const valueClasses = unavailable
    ? "text-[#81766b]"
    : card.passed
      ? "text-[#315d3a]"
      : "text-[#7b3834]";
  return (
    <section className={`flex min-h-[175px] min-w-0 flex-col justify-between rounded-[20px] border px-5 py-6 text-center shadow-[0_8px_30px_rgba(84,68,48,0.05)] ${classes}`}>
      <h2 className="font-serif text-[18px] font-semibold tracking-[-0.01em] text-[#40372f]">{card.title}</h2>
      <p className="mt-2 min-h-[34px] text-[11px] leading-[17px] text-[#8f8377]">{card.subtitle}</p>
      <p
        className={`mt-4 font-semibold leading-none tracking-[-0.035em] ${valueClasses}`}
        style={{ fontSize: "26px" }}
      >
        {unavailable ? "—" : `${formatNumber(card.value, 2)}${card.suffix}`}
      </p>
    </section>
  );
}
export default function RecherchePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanySearchResult | null>(null);
  const [financials, setFinancials] = useState<CompanyFinancialsResponse | null>(null);
  const [stockAnalysis, setStockAnalysis] = useState<StockAnalysisResponse | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [financialsLoading, setFinancialsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function searchCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setSearchLoading(true);
    setError(null);
    setResults([]);
    setSelectedCompany(null);
    setFinancials(null);
    setStockAnalysis(null);
    try {
      const response = await fetch(`/api/company-search?q=${encodeURIComponent(value)}`);
      const data = (await response.json()) as CompanySearchResponse;
      if (!response.ok || !data.success) throw new Error(data.error ?? "Impossible d'effectuer la recherche.");
      const nextResults = Array.isArray(data.results) ? data.results : [];
      setResults(nextResults);
      if (nextResults.length === 0) setError("Aucune entreprise trouvée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSearchLoading(false);
    }
  }
  async function selectCompany(company: CompanySearchResult) {
    setSelectedCompany(company);
    setQuery(company.name);
    setResults([]);
    setError(null);
    setFinancials(null);
    setStockAnalysis(null);
    setFinancialsLoading(true);
    try {
      const stockAnalysisTicker = company.symbol
        .trim()
        .toUpperCase()
        .replace(/\.PA$/, "");
      const [financialsResponse, stockAnalysisResponse] =
        await Promise.all([
          fetch(
            `/api/company-financials?symbol=${encodeURIComponent(company.symbol)}`,
            { cache: "no-store" }
          ),
          fetch(
            `/api/financials/stockanalysis?ticker=${encodeURIComponent(stockAnalysisTicker)}`,
            { cache: "no-store" }
          ),
        ]);
      const data =
        (await financialsResponse.json()) as CompanyFinancialsResponse;
      if (!financialsResponse.ok || !data.success) {
        throw new Error(
          data.error ??
            "Impossible de calculer les données de cette entreprise."
        );
      }
      let stockData: StockAnalysisResponse | null = null;
      if (stockAnalysisResponse.ok) {
        stockData =
          (await stockAnalysisResponse.json()) as StockAnalysisResponse;
      }
      setFinancials(data);
      setStockAnalysis(stockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue pendant l'analyse.");
    } finally {
      setFinancialsLoading(false);
    }
  }
  const history = useMemo(() => sortHistory(financials?.annual ?? []), [financials]);
  const revenue = useMemo(() => history.map((row) => ({
    year: row.year,
    value: row.revenue === null ? null : row.revenue / 1_000_000,
  })), [history]);
  const grossMargin = useMemo(() => history.map((row) => ({
    year: row.year,
    value: calculateMargin(row.grossProfit, row.revenue),
  })), [history]);
  const fcfMargin = useMemo(() => history.map((row) => ({
    year: row.year,
    value: calculateMargin(row.freeCashFlow, row.revenue),
  })), [history]);
  const fcfPerShare = useMemo(() => history.map((row) => ({
    year: row.year,
    value: calculateFcfPerShare(row.freeCashFlow, row.dilutedShares),
  })), [history]);
  const superRoic = useMemo(() => {
    if (Array.isArray(financials?.historicalSuperRoic)) {
      return financials.historicalSuperRoic.filter((row) => row.value !== null && Number.isFinite(row.value));
    }
    return history.map((row) => ({
      year: row.year,
      value: calculateSuperRoic(row.freeCashFlow, row.stockBasedCompensation, row.totalAssets, row.goodwill, row.currentLiabilities),
    })).filter((row) => row.value !== null && Number.isFinite(row.value));
  }, [financials, history]);
  const cashDebt = useMemo(() => history.map((row) => ({
    year: row.year,
    cash: row.cashAndShortTermInvestments === null
      ? row.cash === null ? null : row.cash / 1_000_000
      : row.cashAndShortTermInvestments / 1_000_000,
    debt: row.totalDebt === null ? null : row.totalDebt / 1_000_000,
  })), [history]);
  const criteriaEngine = useMemo(() => {
    if (!financials?.annual || !selectedCompany) return null;
    const stockAnalysisNetDebt =
      stockAnalysis?.balanceSheet?.netDebt ?? null;
    const automaticNetDebt =
      stockAnalysisNetDebt !== null &&
      Number.isFinite(stockAnalysisNetDebt)
        ? stockAnalysisNetDebt
        : financials.latestQuarterlyBalanceSheet?.netDebt ?? null;
    const latestStockAnalysisUfcf =
      stockAnalysis?.annualCashFlow &&
      stockAnalysis.annualCashFlow.unleveredFreeCashFlow !== null &&
      Number.isFinite(
        stockAnalysis.annualCashFlow.unleveredFreeCashFlow
      )
        ? stockAnalysis.annualCashFlow.unleveredFreeCashFlow
        : null;
    return calculateCriteriaFromHistory(
      selectedCompany.symbol,
      financials.annual,
      automaticNetDebt,
      latestStockAnalysisUfcf
    );
  }, [financials, selectedCompany, stockAnalysis]);
  const criteria = useMemo<CriterionCard[]>(() => {
    const c = criteriaEngine;
    if (!c) return [];
    return [
      {
        title: "Croissance du chiffre d'affaires",
        subtitle: "par an sur les 5 dernières années, doit être supérieur à 10%",
        value: c.revenueGrowthCagr,
        suffix: " %",
        passed: c.revenueGrowthCagr === null ? null : c.revenueGrowthCagr > 10,
      },
      {
        title: "Croissance du Free cash flow",
        subtitle: "par an sur les 5 dernières années, doit être supérieur à 10%",
        value: c.freeCashFlowGrowthCagr,
        suffix: " %",
        passed: c.freeCashFlowGrowthCagr === null ? null : c.freeCashFlowGrowthCagr > 10,
      },
      {
        title: "Super ROIC",
        subtitle: "Super ROIC en moyenne sur 5 ans, doit être supérieur à 15%",
        value: c.superRoic,
        suffix: " %",
        passed: c.superRoic === null ? null : c.superRoic > 15,
      },
      {
        title: "Dette nette / Free cash flow",
        subtitle: "au dernier trimestre, doit être inférieur à 3",
        value: c.netDebtToFCF,
        suffix: "",
        passed: c.netDebtToFCF === null ? null : c.netDebtToFCF < 3,
      },
      {
        title: "Nombre d'actions en circulation",
        subtitle: "sur les 5 dernières années, doit être inférieur ou égal à 0%",
        value: c.dilutedSharesChange,
        suffix: " %",
        passed: c.dilutedSharesChange === null ? null : c.dilutedSharesChange <= 0,
      },
      {
        title: "Marge du Free cash flow",
        subtitle: "en moyenne sur 5 ans, doit être supérieur à 10%",
        value: c.averageFcfMargin,
        suffix: " %",
        passed: c.averageFcfMargin === null ? null : c.averageFcfMargin > 10,
      },
    ];
  }, [criteriaEngine]);
  return (
    <main
      className={`${gothicFont.variable} min-h-screen px-4 pb-20 text-[#40372f] sm:px-6 lg:px-10`}
      style={{
        backgroundColor: "#f3eee3",
        backgroundImage: 'url("/fond-analyse.png")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "top center",
        backgroundSize: "100% auto",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="mx-auto max-w-[1500px]">
        <header className="pb-8 pt-10 text-center sm:pb-10 sm:pt-14">
          <div className="relative">
            <Link href="/" className="absolute left-0 top-1/2 -translate-y-1/2 font-serif text-sm text-[#75695e] transition-opacity hover:opacity-60">
              ← Mes actions
            </Link>
            <h1
              className="text-[48px] leading-none tracking-[-0.035em] text-[#40372f] sm:text-[58px]"
              style={{ fontFamily: "var(--font-graphique)" }}
            >
              Analyse d&apos;entreprise
            </h1>
          </div>
          <div className="mt-7 h-px bg-[#d9d0c3]" />
        </header>
        <section className="mx-auto max-w-3xl">
          <form onSubmit={searchCompany} className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setResults([]);
                setError(null);
              }}
              placeholder="Nom de l'entreprise ou symbole boursier"
              className="min-w-0 flex-1 rounded-[18px] border border-[#ded6ca] bg-[#fdfbf5] px-5 py-4 font-serif text-base text-[#40372f] shadow-[0_8px_30px_rgba(84,68,48,0.04)] outline-none placeholder:text-[#a0968a] focus:border-[#9b8e80]"
            />
            <button
              type="submit"
              disabled={!query.trim() || searchLoading}
              className="rounded-[18px] bg-[#40372f] px-6 py-4 font-serif text-sm font-semibold text-[#fdfbf5] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {searchLoading ? "Recherche…" : "Rechercher"}
            </button>
          </form>
          {results.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-[18px] border border-[#ded6ca] bg-[#fdfbf5] shadow-[0_8px_30px_rgba(84,68,48,0.06)]">
              {results.map((company) => (
                <button
                  key={`${company.symbol}-${company.exchange ?? ""}`}
                  type="button"
                  onClick={() => selectCompany(company)}
                  className="flex w-full items-center justify-between gap-5 border-b border-[#e8e0d5] px-5 py-4 text-left transition last:border-b-0 hover:bg-[#f7f2e9]"
                >
                  <div className="min-w-0">
                    <p className="font-serif font-semibold text-[#40372f]">{company.name}</p>
                    <p className="mt-1 text-xs text-[#9a8f83]">{company.exchange ?? "Bourse non précisée"}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-[#6f6358]">{company.symbol}</span>
                </button>
              ))}
            </div>
          )}
          {error && <p className="mt-4 text-center font-serif text-sm text-[#7b3834]">{error}</p>}
        </section>
        {financialsLoading && (
          <div className="mt-10 rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] px-6 py-16 text-center shadow-[0_8px_30px_rgba(84,68,48,0.05)]">
            <p className="font-serif text-lg text-[#65594e]">Calcul de l&apos;analyse…</p>
            <p className="mt-2 text-xs text-[#9a8f83]">Récupération des données financières.</p>
          </div>
        )}
        {!financialsLoading && selectedCompany && financials?.criteria && (
          <>
            <section className="pb-8 pt-12 text-center">
              <h2 className="font-serif text-4xl font-semibold tracking-[-0.03em] text-[#40372f]">{selectedCompany.name}</h2>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b8e80]">
                {selectedCompany.symbol}{selectedCompany.exchange ? ` · ${selectedCompany.exchange}` : ""}
              </p>
              {financials.period && (
                <p className="mt-3 font-serif text-sm text-[#75695e]">
                  Critères calculés sur {financials.period.startYear} — {financials.period.endYear}
                </p>
              )}
            </section>
            <div className="mx-auto grid max-w-[1380px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
              {criteria.map((card) => <CriterionCardView key={card.title} card={card} />)}
            </div>
            <header className="pb-8 pt-14 sm:pb-10">
              <div className="flex items-end justify-between gap-8">
                <div className="flex items-end gap-8">
                  <h2
                    className="text-[48px] leading-none tracking-[-0.035em] text-[#40372f] sm:text-[58px]"
                    style={{ fontFamily: "var(--font-graphique)" }}
                  >
                    Graphiques
                  </h2>
                  {history.length > 0 && (
                    <div className="pb-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8e80]">Historique financier</p>
                      <p className="mt-1 font-serif text-sm text-[#6f6358]">
                        {history[0]?.year} — {history[history.length - 1]?.year}
                      </p>
                    </div>
                  )}
                </div>
                <div className="pb-1 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8e80]">Entreprise</p>
                  <p className="mt-1 font-serif text-lg font-semibold text-[#40372f]">{selectedCompany.name}</p>
                </div>
              </div>
              <div className="mt-7 h-px bg-[#d9d0c3]" />
            </header>
            {history.length > 0 ? (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                <GraphCard title="Croissance du chiffre d'affaires" description="Évolution annuelle du chiffre d'affaires">
                  <PremiumBarChart data={revenue} valueKey="revenue" formatter={(value) => value === null ? "—" : `${formatNumber(value, 0)} M€`} />
                </GraphCard>
                <GraphCard title="Free Cash Flow annuel" description="Flux de trésorerie disponible généré chaque année">
                  <PremiumBarChart data={history.map((row) => ({ year: row.year, value: row.freeCashFlow === null ? null : row.freeCashFlow / 1_000_000 }))} valueKey="free-cash-flow" formatter={(value) => value === null ? "—" : `${formatNumber(value, 0)} M€`} />
                </GraphCard>
                <GraphCard title="Free Cash Flow par action" description="Free Cash Flow rapporté au nombre d'actions diluées">
                  <PremiumBarChart data={fcfPerShare} valueKey="fcf-per-share" formatter={formatPerShare} />
                </GraphCard>
                <GraphCard title="Super ROIC" description="(FCF − SBC) / (Total Assets − Goodwill − Current Liabilities)">
                  <PremiumLineChart data={superRoic} valueKey="super-roic" percent formatter={formatPercent} />
                </GraphCard>
                <GraphCard title="Marge brute" description="Résultat brut rapporté au chiffre d'affaires">
                  <PremiumLineChart data={grossMargin} valueKey="gross-margin" percent formatter={formatPercent} />
                </GraphCard>
                <GraphCard title="Marge du Free Cash Flow" description="Free Cash Flow rapporté au chiffre d'affaires">
                  <PremiumLineChart data={fcfMargin} valueKey="fcf-margin" percent formatter={formatPercent} />
                </GraphCard>
                <GraphCard title="Actions en circulation diluées" description="Évolution du nombre moyen d'actions diluées">
                  <PremiumBarChart data={history.map((row) => ({ year: row.year, value: row.dilutedShares === null ? null : row.dilutedShares / 1_000_000 }))} valueKey="diluted-shares" formatter={(value) => value === null ? "—" : `${formatNumber(value, 1)} M`} />
                </GraphCard>
                <GraphCard title="Cash & dettes" description="Évolution de la trésorerie et de la dette totale">
                  <PremiumCashDebtChart data={cashDebt} />
                </GraphCard>
              </div>
            ) : (
              <div className="rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] px-6 py-16 text-center">
                <p className="font-serif text-lg text-[#65594e]">Aucune donnée historique disponible.</p>
              </div>
            )}
          <ValuationSection company={selectedCompany.name} symbol={selectedCompany.symbol} />
          </>
        )}
        <footer className="mt-8 border-t border-[#d9d0c3] pt-5 text-[10px] leading-5 text-[#a0968a]">
          Les valeurs non disponibles restent indisponibles.
        </footer>
      </div>
    </main>
  );
}
