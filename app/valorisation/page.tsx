"use client";

import localFont from "next/font/local";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useSearchParams,
} from "next/navigation";

const gothicFont =
  localFont({
    src: "../fonts/UnifrakturMaguntia-Book.ttf",
    variable:
      "--font-valorisation",
    display: "swap",
  });

type PfcfPoint = {
  year: number;
  price: number;
  freeCashFlow: number;
  dilutedShares: number;
  normalizedDilutedShares:
    number;
  freeCashFlowPerShare:
    number;
  pfcf: number;
};

type ValuationResponse = {
  success: boolean;

  company?: string;
  requestedCompany?: string;
  symbol?: string;
  currency?: string;

  currentPrice?:
    | number
    | null;

  baseData?: {
    year:
      | number
      | null;

    freeCashFlow:
      | number
      | null;

    dilutedShares:
      | number
      | null;

    normalizedDilutedShares:
      | number
      | null;

    freeCashFlowPerShare:
      | number
      | null;
  };

  fcfPerShare?: {
    current:
      | number
      | null;

    average5Years:
      | number
      | null;

    average10Years:
      | number
      | null;
  };

  growth?: {
    current:
      | number
      | null;

    average5Years:
      | number
      | null;

    average10Years:
      | number
      | null;
  };

  pfcf?: {
    current:
      | number
      | null;

    historicalAverage:
      | number
      | null;

    average5Years:
      | number
      | null;

    average10Years:
      | number
      | null;

    history:
      PfcfPoint[];
  };

  error?: string;
};

type PurchaseZone = {
  margin: number;
  price: number;
};

function formatNumber(
  value:
    | number
    | null
    | undefined,
  decimals = 1
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "fr-FR",
    {
      minimumFractionDigits:
        decimals,
      maximumFractionDigits:
        decimals,
    }
  ).format(value);
}

function formatCurrency(
  value:
    | number
    | null
    | undefined,
  currency: string
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        minimumFractionDigits:
          2,
        maximumFractionDigits:
          2,
      }
    ).format(value);
  } catch {
    return `${formatNumber(
      value,
      2
    )} ${currency}`;
  }
}

function formatAxisCurrency(
  value: number,
  currency: string
) {
  try {
    return new Intl.NumberFormat(
      "fr-FR",
      {
        style: "currency",
        currency,
        minimumFractionDigits:
          0,
        maximumFractionDigits:
          0,
      }
    ).format(value);
  } catch {
    return `${formatNumber(
      value,
      0
    )} ${currency}`;
  }
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children:
    React.ReactNode;
}) {
  return (
    <section className="h-full rounded-[22px] border border-[#ded6ca] bg-[#fdfbf5] p-5 shadow-[0_8px_30px_rgba(84,68,48,0.06)] sm:p-6">
      <div className="mb-5">
        <h2 className="font-serif text-[18px] font-semibold tracking-[-0.01em] text-[#40372f]">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-[11px] leading-5 text-[#9a8f83]">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function HypothesisInput({
  value,
  onChange,
  suffix,
  step = 0.1,
}: {
  value: number;
  onChange:
    (value: number) => void;
  suffix: string;
  step?: number;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[150px] items-center rounded-xl border border-[#cfc4b6] bg-[#faf7ef] shadow-[inset_0_1px_2px_rgba(84,68,48,0.04)]">
      <input
        type="number"
        value={value}
        step={step}
        onChange={(
          event
        ) => {
          const next =
            Number(
              event.target.value
            );

          if (
            Number.isFinite(
              next
            )
          ) {
            onChange(next);
          }
        }}
        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-right font-serif text-[16px] font-semibold text-[#40372f] outline-none"
      />

      <span className="pr-3 text-[11px] font-semibold text-[#8f8275]">
        {suffix}
      </span>
    </div>
  );
}

function HistoricalValue({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="font-serif text-[15px] font-semibold text-[#4a4037]">
      {children}
    </div>
  );
}

/* =========================================================
   ZONE D'ACHAT
   ========================================================= */

function PurchaseZoneChart({
  zones,
  currentPrice,
  currency,
}: {
  zones:
    PurchaseZone[];
  currentPrice:
    number | null;
  currency: string;
}) {
  if (
    zones.length === 0
  ) {
    return (
      <div className="flex h-[330px] items-center justify-center text-sm text-[#9a8f83]">
        Zone d&apos;achat
        indisponible.
      </div>
    );
  }

  const width = 650;
  const height = 380;

  const paddingLeft = 68;
  const paddingRight = 25;
  const paddingTop = 42;
  const paddingBottom = 55;

  const chartWidth =
    width -
    paddingLeft -
    paddingRight;

  const chartHeight =
    height -
    paddingTop -
    paddingBottom;

  const allValues = [
    ...zones.map(
      (zone) =>
        zone.price
    ),

    ...(currentPrice !==
    null
      ? [currentPrice]
      : []),
  ];

  const maximum =
    Math.max(
      ...allValues,
      1
    ) * 1.12;

  const yFor = (
    value: number
  ) =>
    paddingTop +
    chartHeight -
    (value / maximum) *
      chartHeight;

  const slotWidth =
    chartWidth /
    zones.length;

  const barWidth =
    Math.min(
      34,
      slotWidth * 0.62
    );

  const currentY =
    currentPrice !== null
      ? yFor(currentPrice)
      : null;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Zone d'achat selon la marge de sécurité"
      >
        {[0, 1, 2, 3, 4].map(
          (index) => {
            const ratio =
              index / 4;

            const value =
              maximum -
              maximum *
                ratio;

            const y =
              paddingTop +
              chartHeight *
                ratio;

            return (
              <g key={index}>
                <line
                  x1={
                    paddingLeft
                  }
                  y1={y}
                  x2={
                    width -
                    paddingRight
                  }
                  y2={y}
                  stroke="#ded6ca"
                  strokeWidth="1"
                />

                <text
                  x={
                    paddingLeft -
                    10
                  }
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#9a8f83"
                >
                  {formatAxisCurrency(
                    value,
                    currency
                  )}
                </text>
              </g>
            );
          }
        )}

        {currentY !==
          null && (
          <>
            <line
              x1={
                paddingLeft
              }
              y1={
                currentY
              }
              x2={
                width -
                paddingRight
              }
              y2={
                currentY
              }
              stroke="#b08a2e"
              strokeWidth="2"
              strokeDasharray="7 6"
            />

            <rect
              x={
                width -
                paddingRight -
                145
              }
              y={
                currentY -
                25
              }
              width="145"
              height="19"
              rx="6"
              fill="#fdfbf5"
            />

            <text
              x={
                width -
                paddingRight -
                5
              }
              y={
                currentY -
                11
              }
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              fill="#9a7426"
            >
              Cours actuel :{" "}
              {formatCurrency(
                currentPrice,
                currency
              )}
            </text>
          </>
        )}

        {zones.map(
          (
            zone,
            index
          ) => {
            const centerX =
              paddingLeft +
              slotWidth *
                index +
              slotWidth / 2;

            const y =
              yFor(
                zone.price
              );

            const barHeight =
              paddingTop +
              chartHeight -
              y;

            return (
              <g
                key={
                  zone.margin
                }
              >
                <rect
                  x={
                    centerX -
                    barWidth /
                      2
                  }
                  y={y}
                  width={
                    barWidth
                  }
                  height={
                    barHeight
                  }
                  rx="5"
                  fill="#5b2a72"
                >
                  <title>
                    Marge{" "}
                    {
                      zone.margin
                    }{" "}
                    % :{" "}
                    {formatCurrency(
                      zone.price,
                      currency
                    )}
                  </title>
                </rect>

                {zone.margin <
                  100 && (
                  <text
                    x={
                      centerX
                    }
                    y={Math.max(
                      paddingTop +
                        10,
                      y - 9
                    )}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#5b2a72"
                  >
                    {formatAxisCurrency(
                      zone.price,
                      currency
                    )}
                  </text>
                )}

                {zone.margin ===
                  100 && (
                  <text
                    x={
                      centerX
                    }
                    y={
                      paddingTop +
                      chartHeight -
                      8
                    }
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#5b2a72"
                  >
                    {formatAxisCurrency(
                      zone.price,
                      currency
                    )}
                  </text>
                )}

                <text
                  x={centerX}
                  y={
                    height -
                    20
                  }
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="700"
                  fill="#75695e"
                >
                  {
                    zone.margin
                  }
                  %
                </text>
              </g>
            );
          }
        )}
      </svg>
    </div>
  );
}

/* =========================================================
   PRIX / FREE CASH FLOW
   ========================================================= */

function PfcfChart({
  data,
  average,
}: {
  data: PfcfPoint[];
  average:
    number | null;
}) {
  const valid =
    data.filter(
      (row) =>
        Number.isFinite(
          row.pfcf
        ) &&
        row.pfcf > 0
    );

  if (
    valid.length < 2
  ) {
    return (
      <div className="flex h-[330px] items-center justify-center text-sm text-[#9a8f83]">
        Historique P/FCF
        insuffisant.
      </div>
    );
  }

  const width = 650;
  const height = 315;

  const paddingLeft = 55;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 48;

  const chartWidth =
    width -
    paddingLeft -
    paddingRight;

  const chartHeight =
    height -
    paddingTop -
    paddingBottom;

  const values =
    valid.map(
      (row) =>
        row.pfcf
    );

  if (
    average !== null &&
    Number.isFinite(
      average
    )
  ) {
    values.push(
      average
    );
  }

  const minValue =
    Math.min(
      ...values
    );

  const maxValue =
    Math.max(
      ...values
    );

  const range =
    maxValue -
      minValue ||
    1;

  const minY =
    Math.max(
      0,
      minValue -
        range * 0.15
    );

  const maxY =
    maxValue +
    range * 0.15;

  const yRange =
    maxY - minY || 1;

  const xFor = (
    index: number
  ) =>
    paddingLeft +
    (index /
      (valid.length -
        1)) *
      chartWidth;

  const yFor = (
    value: number
  ) =>
    paddingTop +
    ((maxY - value) /
      yRange) *
      chartHeight;

  const points =
    valid
      .map(
        (
          row,
          index
        ) =>
          `${xFor(
            index
          )},${yFor(
            row.pfcf
          )}`
      )
      .join(" ");

  const areaPoints =
    `${paddingLeft},${
      paddingTop +
      chartHeight
    } ${points} ${
      width -
      paddingRight
    },${
      paddingTop +
      chartHeight
    }`;

  const averageY =
    average !== null &&
    Number.isFinite(
      average
    )
      ? yFor(average)
      : null;

  const labelEvery =
    valid.length > 12
      ? Math.ceil(
          valid.length / 7
        )
      : 1;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Historique Prix sur Free Cash Flow"
      >
        <defs>
          <linearGradient
            id="pfcfArea"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#5b2a72"
              stopOpacity="0.22"
            />

            <stop
              offset="100%"
              stopColor="#5b2a72"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4].map(
          (index) => {
            const ratio =
              index / 4;

            const value =
              maxY -
              yRange *
                ratio;

            const y =
              paddingTop +
              chartHeight *
                ratio;

            return (
              <g key={index}>
                <line
                  x1={
                    paddingLeft
                  }
                  y1={y}
                  x2={
                    width -
                    paddingRight
                  }
                  y2={y}
                  stroke="#ded6ca"
                  strokeWidth="1"
                />

                <text
                  x={
                    paddingLeft -
                    10
                  }
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#9a8f83"
                >
                  {formatNumber(
                    value,
                    1
                  )}
                  ×
                </text>
              </g>
            );
          }
        )}

        {averageY !==
          null && (
          <>
            <line
              x1={
                paddingLeft
              }
              y1={
                averageY
              }
              x2={
                width -
                paddingRight
              }
              y2={
                averageY
              }
              stroke="#b08a2e"
              strokeWidth="1.5"
              strokeDasharray="7 6"
            />

            <text
              x={
                width -
                paddingRight
              }
              y={
                averageY -
                8
              }
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              fill="#9a7426"
            >
              Moyenne{" "}
              {formatNumber(
                average,
                1
              )}
              ×
            </text>
          </>
        )}

        <polygon
          points={
            areaPoints
          }
          fill="url(#pfcfArea)"
        />

        <polyline
          points={points}
          fill="none"
          stroke="#5b2a72"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {valid.map(
          (
            row,
            index
          ) => {
            const x =
              xFor(index);

            const y =
              yFor(
                row.pfcf
              );

            return (
              <g
                key={
                  row.year
                }
              >
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="#fdfbf5"
                  stroke="#5b2a72"
                  strokeWidth="2.2"
                >
                  <title>
                    {
                      row.year
                    }{" "}
                    —{" "}
                    {formatNumber(
                      row.pfcf,
                      2
                    )}
                    ×
                  </title>
                </circle>

                {(index %
                  labelEvery ===
                  0 ||
                  index ===
                    valid.length -
                      1) && (
                  <text
                    x={x}
                    y={
                      height -
                      15
                    }
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="#75695e"
                  >
                    {
                      row.year
                    }
                  </text>
                )}
              </g>
            );
          }
        )}
      </svg>
    </div>
  );
}

/* =========================================================
   PAGE
   ========================================================= */

function ValorisationContent() {
  const searchParams =
    useSearchParams();

  const company =
    searchParams.get(
      "company"
    ) || "LVMH";

  const symbol =
    searchParams.get(
      "symbol"
    );

  const [data, setData] =
    useState<
      ValuationResponse | null
    >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(null);

  const [
    fcfPerShare,
    setFcfPerShare,
  ] = useState(0);

  const [
    growthRate,
    setGrowthRate,
  ] = useState(8);

  const [
    targetPfcf,
    setTargetPfcf,
  ] = useState(20);

  const [
    requiredReturn,
    setRequiredReturn,
  ] = useState(10);

  useEffect(() => {
    let cancelled =
      false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params =
          new URLSearchParams();

        params.set(
          "company",
          company
        );

        if (symbol) {
          params.set(
            "symbol",
            symbol
          );
        }

        const response =
          await fetch(
            `/api/valuation?${params.toString()}`,
            {
              cache:
                "no-store",
            }
          );

        const json =
          (await response.json()) as ValuationResponse;

        if (
          !response.ok ||
          !json.success
        ) {
          throw new Error(
            json.error ??
              "Impossible de charger la valorisation."
          );
        }

        if (!cancelled) {
          setData(json);

          const currentFcf =
            json.fcfPerShare
              ?.current ??
            json.baseData
              ?.freeCashFlowPerShare;

          if (
            currentFcf !==
              null &&
            currentFcf !==
              undefined &&
            Number.isFinite(
              currentFcf
            )
          ) {
            setFcfPerShare(
              Number(
                currentFcf.toFixed(
                  2
                )
              )
            );
          }

          /*
           * Hypothèse de croissance :
           * moyenne historique 5 ans
           * lorsqu'elle est disponible.
           */
          const averageGrowth5 =
            json.growth
              ?.average5Years;

          if (
            averageGrowth5 !==
              null &&
            averageGrowth5 !==
              undefined &&
            Number.isFinite(
              averageGrowth5
            )
          ) {
            setGrowthRate(
              Number(
                averageGrowth5.toFixed(
                  1
                )
              )
            );
          }

          /*
           * Hypothèse P/FCF :
           * moyenne historique 10 ans
           * lorsqu'elle est disponible.
           */
          const averagePfcf10 =
            json.pfcf
              ?.average10Years;

          if (
            averagePfcf10 !==
              null &&
            averagePfcf10 !==
              undefined &&
            Number.isFinite(
              averagePfcf10
            )
          ) {
            setTargetPfcf(
              Number(
                averagePfcf10.toFixed(
                  1
                )
              )
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof
            Error
              ? err.message
              : "Impossible de charger les données."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(
            false
          );
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    company,
    symbol,
  ]);

  const currency =
    data?.currency ??
    "EUR";

  /*
   * =======================================================
   * MOTEUR DE VALORISATION
   * =======================================================
   *
   * Horizon fixe : 10 ans
   *
   * FCF/action futur =
   * FCF/action actuel × (1 + croissance)^10
   *
   * Prix futur =
   * FCF/action futur × P/FCF cible
   *
   * Prix juste actuel =
   * Prix futur / (1 + rendement exigé)^10
   */

  const valuation =
    useMemo(() => {
      if (
        !Number.isFinite(
          fcfPerShare
        ) ||
        fcfPerShare <= 0 ||
        !Number.isFinite(
          targetPfcf
        ) ||
        targetPfcf <= 0 ||
        !Number.isFinite(
          growthRate
        ) ||
        growthRate <= -100 ||
        !Number.isFinite(
          requiredReturn
        ) ||
        requiredReturn <= -100
      ) {
        return null;
      }

      const years = 10;

      const growth =
        growthRate / 100;

      const returnRate =
        requiredReturn / 100;

      const futureFcfPerShare =
        fcfPerShare *
        Math.pow(
          1 + growth,
          years
        );

      const futurePrice =
        futureFcfPerShare *
        targetPfcf;

      const fairValue =
        futurePrice /
        Math.pow(
          1 + returnRate,
          years
        );

      if (
        !Number.isFinite(
          fairValue
        ) ||
        fairValue <= 0
      ) {
        return null;
      }

      return {
        years,
        futureFcfPerShare,
        futurePrice,
        fairValue,
      };
    }, [
      fcfPerShare,
      growthRate,
      targetPfcf,
      requiredReturn,
    ]);

  const fairValue =
    valuation?.fairValue ??
    null;

  const purchaseZones =
    useMemo<
      PurchaseZone[]
    >(() => {
      if (
        fairValue === null ||
        fairValue <= 0
      ) {
        return [];
      }

      return [
        0,
        10,
        20,
        30,
        40,
        50,
        60,
        70,
        80,
        90,
        100,
      ].map(
        (margin) => ({
          margin,

          price:
            fairValue *
            (1 -
              margin /
                100),
        })
      );
    }, [fairValue]);

  return (
    <main
      className={`${gothicFont.variable} min-h-screen px-4 pb-20 text-[#40372f] sm:px-6 lg:px-10`}
      style={{
        backgroundColor:
          "#f3eee3",

        backgroundImage:
          'url("/fond-graphiques.png")',

        backgroundRepeat:
          "no-repeat",

        backgroundPosition:
          "top center",

        backgroundSize:
          "100% auto",

        backgroundAttachment:
          "fixed",
      }}
    >
      <div className="mx-auto max-w-[1500px]">
        <header className="pb-8 pt-10 sm:pb-10 sm:pt-14">
          <div className="flex items-end justify-between gap-8">
            <h1
              className="text-[48px] leading-none tracking-[-0.035em] text-[#40372f] sm:text-[58px]"
              style={{
                fontFamily:
                  "var(--font-valorisation)",
              }}
            >
              Valorisation
            </h1>

            <div className="pb-1 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9b8e80]">
                Entreprise
              </p>

              <p className="mt-1 font-serif text-lg font-semibold text-[#40372f]">
                {company}
              </p>
            </div>
          </div>

          <div className="mt-7 h-px bg-[#d9d0c3]" />
        </header>

        {loading && (
          <Card title="Valorisation">
            <div className="py-16 text-center font-serif text-lg text-[#65594e]">
              Chargement…
            </div>
          </Card>
        )}

        {!loading &&
          error && (
            <div className="rounded-[22px] border border-red-200 bg-red-50 px-6 py-12 text-center text-red-800">
              {error}
            </div>
          )}

        {!loading &&
          !error &&
          data && (
            <div className="space-y-5">

              {/* =========================================
                  TABLEAU DE VALORISATION
                 ========================================= */}

              <Card
                title="Discounted Cash Flow"
                description="Projection sur 10 ans du Free Cash Flow par action"
              >
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_250px] xl:items-stretch">

                  <div className="overflow-x-auto">
                    <div className="min-w-[850px] overflow-hidden rounded-[18px] border border-[#ded6ca]">

                      {/* EN-TÊTE NIVEAU 1 */}

                      <div className="grid grid-cols-[1.55fr_repeat(3,1fr)_1.15fr] border-b border-[#ded6ca] bg-[#f7f2e8]">
                        <div className="border-r border-[#ded6ca] px-5 py-3" />

                        <div className="col-span-3 border-r border-[#ded6ca] px-5 py-3 text-center">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#75695e]">
                            Historique
                          </span>
                        </div>

                        <div className="px-5 py-3 text-center">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5b2a72]">
                            Hypothèses
                          </span>
                        </div>
                      </div>

                      {/* EN-TÊTE NIVEAU 2 */}

                      <div className="grid grid-cols-[1.55fr_repeat(3,1fr)_1.15fr] border-b border-[#ded6ca] bg-[#fbf8f1]">
                        <div className="border-r border-[#ded6ca] px-5 py-3" />

                        <div className="border-r border-[#e5ddd2] px-3 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-[#918579]">
                          Actuel
                        </div>

                        <div className="border-r border-[#e5ddd2] px-3 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-[#918579]">
                          Moyenne 5 ans
                        </div>

                        <div className="border-r border-[#ded6ca] px-3 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-[#918579]">
                          Moyenne 10 ans
                        </div>

                        <div className="px-3 py-3 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-[#918579]">
                          Valeur choisie
                        </div>
                      </div>

                      {/* FCF / ACTION */}

                      <div className="grid min-h-[82px] grid-cols-[1.55fr_repeat(3,1fr)_1.15fr] border-b border-[#e5ddd2] bg-[#fdfbf5]">
                        <div className="flex items-center border-r border-[#ded6ca] px-5 py-4">
                          <div>
                            <p className="font-serif text-[15px] font-semibold text-[#40372f]">
                              Free Cash Flow par action
                            </p>

                            <p className="mt-1 text-[9px] text-[#a09589]">
                              FCF ÷ actions diluées
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#e5ddd2] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatCurrency(
                              data.fcfPerShare
                                ?.current,
                              currency
                            )}
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#e5ddd2] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatCurrency(
                              data.fcfPerShare
                                ?.average5Years,
                              currency
                            )}
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#ded6ca] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatCurrency(
                              data.fcfPerShare
                                ?.average10Years,
                              currency
                            )}
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center bg-[#fbf8f1] px-3 py-4">
                          <HypothesisInput
                            value={
                              fcfPerShare
                            }
                            onChange={
                              setFcfPerShare
                            }
                            suffix={
                              currency
                            }
                            step={0.01}
                          />
                        </div>
                      </div>

                      {/* CROISSANCE */}

                      <div className="grid min-h-[82px] grid-cols-[1.55fr_repeat(3,1fr)_1.15fr] border-b border-[#e5ddd2] bg-[#fdfbf5]">
                        <div className="flex items-center border-r border-[#ded6ca] px-5 py-4">
                          <div>
                            <p className="font-serif text-[15px] font-semibold text-[#40372f]">
                              Taux de croissance
                            </p>

                            <p className="mt-1 text-[9px] text-[#a09589]">
                              Croissance annuelle du FCF par action
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#e5ddd2] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatNumber(
                              data.growth
                                ?.current,
                              2
                            )}
                            %
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#e5ddd2] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatNumber(
                              data.growth
                                ?.average5Years,
                              2
                            )}
                            %
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#ded6ca] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatNumber(
                              data.growth
                                ?.average10Years,
                              2
                            )}
                            %
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center bg-[#fbf8f1] px-3 py-4">
                          <HypothesisInput
                            value={
                              growthRate
                            }
                            onChange={
                              setGrowthRate
                            }
                            suffix="%"
                            step={0.1}
                          />
                        </div>
                      </div>

                      {/* P/FCF */}

                      <div className="grid min-h-[82px] grid-cols-[1.55fr_repeat(3,1fr)_1.15fr] bg-[#fdfbf5]">
                        <div className="flex items-center border-r border-[#ded6ca] px-5 py-4">
                          <div>
                            <p className="font-serif text-[15px] font-semibold text-[#40372f]">
                              Ratio P/FCF
                            </p>

                            <p className="mt-1 text-[9px] text-[#a09589]">
                              Prix ÷ Free Cash Flow par action
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#e5ddd2] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatNumber(
                              data.pfcf
                                ?.current,
                              2
                            )}
                            ×
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#e5ddd2] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatNumber(
                              data.pfcf
                                ?.average5Years,
                              2
                            )}
                            ×
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center border-r border-[#ded6ca] px-3 py-4 text-center">
                          <HistoricalValue>
                            {formatNumber(
                              data.pfcf
                                ?.average10Years,
                              2
                            )}
                            ×
                          </HistoricalValue>
                        </div>

                        <div className="flex items-center justify-center bg-[#fbf8f1] px-3 py-4">
                          <HypothesisInput
                            value={
                              targetPfcf
                            }
                            onChange={
                              setTargetPfcf
                            }
                            suffix="×"
                            step={0.1}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* =====================================
                      PRIX JUSTE + RENDEMENT EXIGÉ
                     ===================================== */}

                  <div className="flex flex-col justify-between rounded-[18px] border border-[#ded6ca] bg-[#faf7ef] p-6">

                    <div>
                      <p className="text-center text-[9px] font-bold uppercase tracking-[0.17em] text-[#8f8275]">
                        Rendement exigé
                      </p>

                      <div className="mt-4">
                        <HypothesisInput
                          value={
                            requiredReturn
                          }
                          onChange={
                            setRequiredReturn
                          }
                          suffix="%"
                          step={0.1}
                        />
                      </div>

                      <p className="mx-auto mt-3 max-w-[190px] text-center text-[9px] leading-4 text-[#a09589]">
                        Rendement annuel utilisé pour actualiser le prix estimé dans 10 ans.
                      </p>
                    </div>

                    <div className="my-6 h-px bg-[#ded6ca]" />

                    <div className="text-center">
                      <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#8f8275]">
                        Prix juste estimé
                      </p>

                      <p className="mt-3 font-serif text-[38px] font-semibold tracking-[-0.03em] text-[#5b2a72]">
                        {formatCurrency(
                          fairValue,
                          currency
                        )}
                      </p>

                      <p className="mt-2 text-[9px] uppercase tracking-[0.12em] text-[#a29689]">
                        Projection sur 10 ans
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* =========================================
                  DEUX GRAPHIQUES
                 ========================================= */}

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">

                <Card
                  title="Zone d'achat"
                  description="Prix selon la marge de sécurité appliquée au prix juste"
                >
                  <PurchaseZoneChart
                    zones={
                      purchaseZones
                    }
                    currentPrice={
                      data.currentPrice ??
                      null
                    }
                    currency={
                      currency
                    }
                  />
                </Card>

                <Card
                  title="Prix / Free Cash Flow"
                  description="Évolution historique du multiple P/FCF"
                >
                  <div className="mb-3 flex justify-center gap-12 border-b border-[#e6ded2] pb-4">

                    <div className="text-center">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9b8e80]">
                        Actuel
                      </p>

                      <p className="mt-1 font-serif text-[22px] font-semibold text-[#40372f]">
                        {data.pfcf
                          ?.current ===
                        null
                          ? "—"
                          : `${formatNumber(
                              data.pfcf
                                ?.current,
                              1
                            )}×`}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9b8e80]">
                        Moyenne
                      </p>

                      <p className="mt-1 font-serif text-[22px] font-semibold text-[#40372f]">
                        {data.pfcf
                          ?.historicalAverage ===
                        null
                          ? "—"
                          : `${formatNumber(
                              data.pfcf
                                ?.historicalAverage,
                              1
                            )}×`}
                      </p>
                    </div>
                  </div>

                  <PfcfChart
                    data={
                      data.pfcf
                        ?.history ??
                      []
                    }
                    average={
                      data.pfcf
                        ?.historicalAverage ??
                      null
                    }
                  />
                </Card>
              </div>
            </div>
          )}
      </div>
    </main>
  );
}

export default function ValorisationPage() {
  return (
    <Suspense
      fallback={null}
    >
      <ValorisationContent />
    </Suspense>
  );
}