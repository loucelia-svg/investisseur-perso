"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type StockPriceChartProps = {
  company: "LVMH" | "Hermès";
};

type PricePoint = {
  date: string;
  close: number;
};

type HoverPoint = PricePoint & {
  x: number;
  y: number;
};

function formatPrice(value: number) {
  return value.toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    "fr-FR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
}

export default function StockPriceChart({
  company,
}: StockPriceChartProps) {
  const [data, setData] = useState<PricePoint[]>(
    []
  );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const [hoveredPoint, setHoveredPoint] =
    useState<HoverPoint | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPrices = async () => {
      try {
        setLoading(true);
        setError(false);

        const response = await fetch(
          "/api/historical-prices"
        );

        if (!response.ok) {
          throw new Error(
            "Impossible de récupérer les cours."
          );
        }

        const json =
          await response.json();

        if (cancelled) return;

        setData(
          company === "LVMH"
            ? json.LVMH ?? []
            : json.Hermès ?? []
        );
      } catch (error) {
        console.error(
          "Erreur graphique du cours :",
          error
        );

        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPrices();

    return () => {
      cancelled = true;
    };
  }, [company]);

  const chart = useMemo(() => {
    if (data.length === 0) {
      return null;
    }

    const width = 900;
    const height = 300;

    const paddingLeft = 65;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const chartWidth =
      width -
      paddingLeft -
      paddingRight;

    const chartHeight =
      height -
      paddingTop -
      paddingBottom;

    const values = data.map(
      (item) => item.close
    );

    const minValue =
      Math.min(...values);

    const maxValue =
      Math.max(...values);

    const range =
      maxValue - minValue || 1;

    const minY =
      minValue - range * 0.08;

    const maxY =
      maxValue + range * 0.08;

    const points = data.map(
      (item, index) => {
        const x =
          paddingLeft +
          (index /
            Math.max(
              data.length - 1,
              1
            )) *
            chartWidth;

        const y =
          paddingTop +
          (1 -
            (item.close - minY) /
              (maxY - minY)) *
            chartHeight;

        return {
          ...item,
          x,
          y,
        };
      }
    );

    const line = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${
            point.x
          } ${point.y}`
      )
      .join(" ");

    const area = `${line} L ${
      points[points.length - 1].x
    } ${
      paddingTop + chartHeight
    } L ${
      points[0].x
    } ${
      paddingTop + chartHeight
    } Z`;

    return {
      width,
      height,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      chartWidth,
      chartHeight,
      minValue,
      maxValue,
      points,
      line,
      area,
    };
  }, [data]);

  const handleMouseMove = (
    event: React.MouseEvent<SVGSVGElement>
  ) => {
    if (!chart) return;

    const svg =
      event.currentTarget;

    const rect =
      svg.getBoundingClientRect();

    const mouseX =
      ((event.clientX -
        rect.left) /
        rect.width) *
      chart.width;

    let closest =
      chart.points[0];

    let closestDistance =
      Math.abs(
        chart.points[0].x -
          mouseX
      );

    for (const point of chart.points) {
      const distance =
        Math.abs(
          point.x - mouseX
        );

      if (
        distance <
        closestDistance
      ) {
        closest = point;
        closestDistance = distance;
      }
    }

    setHoveredPoint(closest);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  if (loading) {
    return (
      <div className="mt-5">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-700">
            Cours de l'action
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            Évolution historique
          </p>
        </div>

        <div className="flex h-[300px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">
          Chargement du graphique…
        </div>
      </div>
    );
  }

  if (error || !chart) {
    return (
      <div className="mt-5">
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-700">
            Cours de l'action
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            Évolution historique
          </p>
        </div>

        <div className="flex h-[300px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">
          Données historiques indisponibles.
        </div>
      </div>
    );
  }

  const firstPoint =
    chart.points[0];

  const lastPoint =
    chart.points[
      chart.points.length - 1
    ];

  const middlePoint =
    chart.points[
      Math.floor(
        chart.points.length / 2
      )
    ];

  return (
    <div className="mt-5">

      {/* ========================= */}
      {/* TITRE DU GRAPHIQUE */}
      {/* ========================= */}

      <div className="mb-3 flex items-end justify-between">

        <div>
          <p className="text-sm font-semibold text-slate-700">
            Cours de l'action
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            Évolution historique
          </p>
        </div>

        <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
          {data.length} points
        </p>

      </div>

      {/* ========================= */}
      {/* GRAPHIQUE */}
      {/* ========================= */}

      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">

        <div className="p-4">

          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="h-[300px] w-full cursor-crosshair"
            preserveAspectRatio="none"
            onMouseMove={
              handleMouseMove
            }
            onMouseLeave={
              handleMouseLeave
            }
          >

            <defs>

              {/* Dégradé bordeaux sous la courbe */}
              <linearGradient
                id={`stock-gradient-${company}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#7f1734"
                  stopOpacity="0.20"
                />

                <stop
                  offset="100%"
                  stopColor="#7f1734"
                  stopOpacity="0"
                />
              </linearGradient>

            </defs>

            {/* ========================= */}
            {/* GRILLE */}
            {/* ========================= */}

            {[0, 0.25, 0.5, 0.75, 1].map(
              (ratio) => {
                const y =
                  chart.paddingTop +
                  ratio *
                    chart.chartHeight;

                const value =
                  chart.maxValue -
                  ratio *
                    (chart.maxValue -
                      chart.minValue);

                return (
                  <g key={ratio}>

                    <line
                      x1={
                        chart.paddingLeft
                      }
                      x2={
                        chart.width -
                        chart.paddingRight
                      }
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                      strokeDasharray="5 5"
                    />

                    <text
                      x={
                        chart.paddingLeft -
                        8
                      }
                      y={y + 4}
                      textAnchor="end"
                      fontSize="11"
                      fill="#94a3b8"
                    >
                      {formatPrice(
                        value
                      )}
                    </text>

                  </g>
                );
              }
            )}

            {/* ========================= */}
            {/* SURFACE SOUS LA COURBE */}
            {/* ========================= */}

            <path
              d={chart.area}
              fill={`url(#stock-gradient-${company})`}
            />

            {/* ========================= */}
            {/* COURBE BORDEAUX */}
            {/* ========================= */}

            <path
              d={chart.line}
              fill="none"
              stroke="#7f1734"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* ========================= */}
            {/* DERNIER POINT */}
            {/* ========================= */}

            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="5"
              fill="#7f1734"
            />

            {/* ========================= */}
            {/* SURVOL */}
            {/* ========================= */}

            {hoveredPoint && (
              <>
                <line
                  x1={hoveredPoint.x}
                  x2={hoveredPoint.x}
                  y1={
                    chart.paddingTop
                  }
                  y2={
                    chart.paddingTop +
                    chart.chartHeight
                  }
                  stroke="#7f1734"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.45"
                />

                <circle
                  cx={hoveredPoint.x}
                  cy={hoveredPoint.y}
                  r="6"
                  fill="white"
                  stroke="#7f1734"
                  strokeWidth="3"
                />
              </>
            )}

            {/* ========================= */}
            {/* DATES */}
            {/* ========================= */}

            <text
              x={firstPoint.x}
              y={
                chart.height -
                12
              }
              textAnchor="start"
              fontSize="11"
              fill="#94a3b8"
            >
              {formatDate(
                firstPoint.date
              )}
            </text>

            <text
              x={middlePoint.x}
              y={
                chart.height -
                12
              }
              textAnchor="middle"
              fontSize="11"
              fill="#94a3b8"
            >
              {formatDate(
                middlePoint.date
              )}
            </text>

            <text
              x={lastPoint.x}
              y={
                chart.height -
                12
              }
              textAnchor="end"
              fontSize="11"
              fill="#94a3b8"
            >
              {formatDate(
                lastPoint.date
              )}
            </text>

          </svg>

        </div>

        {/* ========================= */}
        {/* INFOBULLE */}
        {/* ========================= */}

        {hoveredPoint && (
          <div
            className="pointer-events-none absolute z-10 min-w-[150px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
            style={{
              left: `${(
                (hoveredPoint.x /
                  chart.width) *
                100
              ).toFixed(2)}%`,
              top: `${Math.max(
                8,
                (hoveredPoint.y /
                  chart.height) *
                  100 -
                  18
              ).toFixed(2)}%`,
            }}
          >

            <p className="text-xs font-medium text-slate-400">
              {formatDate(
                hoveredPoint.date
              )}
            </p>

            <p className="mt-1 text-lg font-bold text-[#7f1734]">
              {formatPrice(
                hoveredPoint.close
              )}
            </p>

          </div>
        )}

      </div>
    </div>
  );
}