import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

const EULERPOOL_API_KEY = process.env.EULERPOOL_API_KEY;

const COMPANIES = [
  {
    name: "LVMH",
    isin: "FR0000121014",
    symbol: "MC.PA",
  },
  {
    name: "Hermès",
    isin: "FR0000052292",
    symbol: "RMS.PA",
  },
] as const;

const UFCF_TARGETS = {
  LVMH: {
    2021: 13505,
    2022: 10820,
    2023: 9358,
    2024: 12151,
    2025: 12514,
  },
};

type AnnualRow = {
  year: number;
  revenue: number | null;
  freeCashFlow: number | null;
  unleveredFreeCashFlow: number | null;
  operatingIncome: number | null;
  taxProvision: number | null;
  pretaxIncome: number | null;
  equity: number | null;
  totalDebt: number | null;
  cashAndShortTermInvestments: number | null;
  netDebt: number | null;
  dilutedAverageShares: number | null;
  ufcfInputs: {
    EBIT: number | null;
    depreciationAndAmortization: number | null;
    purchaseOfIntangibles: number | null;
    saleOfIntangibles: number | null;
    capitalExpenditure: number | null;
    changeInWorkingCapital: number | null;
  };
};

function toMillions(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value / 1_000_000;
}

/*
 * Eulerpool fournit les données financières en millions.
 * On conserve donc directement la valeur reçue.
 */
function getEulerMillions(
  row: any,
  keys: string[]
): number | null {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = row[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}

function round(
  value: number | null,
  decimals = 3
): number | null {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}

function getValue(
  row: any,
  keys: string[]
): number | null {
  if (!row) {
    return null;
  }

  for (const key of keys) {
    const value = row[key];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return null;
}

function getMillions(
  row: any,
  keys: string[]
): number | null {
  return toMillions(
    getValue(row, keys)
  );
}

/*
 * Yahoo Finance fournit les actions en nombre d'actions.
 * Exemple :
 * 497 976 118 actions
 */
function getShares(
  row: any,
  keys: string[]
): number | null {
  return getValue(row, keys);
}

/*
 * Eulerpool fournit ici le nombre moyen d'actions
 * en millions d'actions.
 *
 * Exemple :
 * 504 = 504 millions d'actions
 *
 * On convertit donc :
 * 504 × 1 000 000 = 504 000 000 actions
 *
 * IMPORTANT :
 * cette conversion concerne uniquement les actions.
 * Elle ne concerne PAS les données financières Eulerpool.
 */
function getEulerShares(
  row: any,
  keys: string[]
): number | null {
  const value = getEulerMillions(
    row,
    keys
  );

  if (value === null) {
    return null;
  }

  return value * 1_000_000;
}

function findYearRow(
  data: any,
  year: number
) {
  const candidates =
    Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.results)
          ? data.results
          : [];

  return candidates.find(
    (row: any) => {
      const date =
        row?.date ??
        row?.period ??
        row?.fiscalDateEnding ??
        row?.periodEndDate;

      if (date instanceof Date) {
        return (
          date.getUTCFullYear() === year
        );
      }

      if (typeof date === "string") {
        return (
          date.startsWith(`${year}-`) ||
          date.startsWith(`${year}`)
        );
      }

      return false;
    }
  );
}

function findYahooYear(
  rows: any[],
  year: number
) {
  return rows.find(
    (row) => {
      const date = row?.date;

      if (date instanceof Date) {
        return (
          date.getUTCFullYear() === year
        );
      }

      if (typeof date === "string") {
        return date.startsWith(
          `${year}-`
        );
      }

      return false;
    }
  );
}

async function getEulerpool(
  endpoint: string,
  isin: string
) {
  if (!EULERPOOL_API_KEY) {
    throw new Error(
      "EULERPOOL_API_KEY manquante"
    );
  }

  const response = await fetch(
    `https://api.eulerpool.com/api/1/equity/${endpoint}/${isin}`,
    {
      headers: {
        Authorization: `Bearer ${EULERPOOL_API_KEY}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Eulerpool ${endpoint} ${isin}: HTTP ${response.status}`
    );
  }

  return response.json();
}

async function getYahooRows(
  symbol: string
) {
  const financials =
    await yahooFinance.fundamentalsTimeSeries(
      symbol,
      {
        period1: "2022-01-01",
        period2: "2027-01-01",
        type: "annual",
        module: "financials",
      }
    );

  const cashFlow =
    await yahooFinance.fundamentalsTimeSeries(
      symbol,
      {
        period1: "2022-01-01",
        period2: "2027-01-01",
        type: "annual",
        module: "cash-flow",
      }
    );

  const balanceSheet =
    await yahooFinance.fundamentalsTimeSeries(
      symbol,
      {
        period1: "2022-01-01",
        period2: "2027-01-01",
        type: "annual",
        module: "balance-sheet",
      }
    );

  return {
    financials:
      Array.isArray(financials)
        ? financials
        : [],

    cashFlow:
      Array.isArray(cashFlow)
        ? cashFlow
        : [],

    balanceSheet:
      Array.isArray(balanceSheet)
        ? balanceSheet
        : [],
  };
}

function calculateUfcf(
  ebit: number | null,
  depreciationAndAmortization: number | null,
  purchaseOfIntangibles: number | null,
  saleOfIntangibles: number | null,
  capex: number | null,
  changeInWorkingCapital: number | null
): number | null {
  if (
    ebit === null ||
    depreciationAndAmortization === null ||
    capex === null ||
    changeInWorkingCapital === null
  ) {
    return null;
  }

  const intangibles =
    (purchaseOfIntangibles ?? 0) +
    (saleOfIntangibles ?? 0);

  return (
    ebit * 0.625 +
    depreciationAndAmortization +
    intangibles -
    Math.abs(capex) +
    changeInWorkingCapital
  );
}

function calculateNetDebt(
  totalDebt: number | null,
  cashAndShortTermInvestments: number | null
): number | null {
  if (
    totalDebt === null ||
    cashAndShortTermInvestments === null
  ) {
    return null;
  }

  return (
    totalDebt -
    cashAndShortTermInvestments
  );
}

function buildAnnualRow(
  year: number,
  financials: any,
  cashFlow: any,
  balanceSheet: any
): AnnualRow {
  const revenue = getMillions(
    financials,
    [
      "totalRevenue",
      "revenue",
      "salesRevenue",
      "sales",
      "revenues",
    ]
  );

  let freeCashFlow =
    getMillions(
      cashFlow,
      ["freeCashFlow"]
    );

  if (freeCashFlow === null) {
    const operatingCashFlow =
      getMillions(
        cashFlow,
        [
          "operatingCashFlow",
          "totalCashFromOperatingActivities",
          "netCashProvidedByOperatingActivities",
        ]
      );

    const capex =
      getMillions(
        cashFlow,
        [
          "capitalExpenditure",
          "capitalExpenditureReported",
        ]
      );

    if (
      operatingCashFlow !== null &&
      capex !== null
    ) {
      freeCashFlow =
        operatingCashFlow + capex;
    }
  }

  const operatingIncome =
    getMillions(
      financials,
      [
        "operatingIncome",
        "EBIT",
      ]
    );

  const pretaxIncome =
    getMillions(
      financials,
      [
        "pretaxIncome",
        "incomeBeforeTax",
        "preTaxIncome",
      ]
    );

  const taxProvision =
    getMillions(
      financials,
      [
        "taxProvision",
        "incomeTaxExpense",
        "taxExpense",
      ]
    );

  const depreciationAndAmortization =
    getMillions(
      cashFlow,
      [
        "depreciationAndAmortization",
        "depreciationAmortizationDepletion",
        "reconciledDepreciation",
      ]
    );

  const purchaseOfIntangibles =
    getMillions(
      cashFlow,
      [
        "purchaseOfIntangibles",
        "purchaseOfIntangibleAssets",
      ]
    );

  const saleOfIntangibles =
    getMillions(
      cashFlow,
      [
        "saleOfIntangibles",
        "saleOfIntangibleAssets",
      ]
    );

  const capex =
    getMillions(
      cashFlow,
      [
        "capitalExpenditure",
        "capitalExpenditureReported",
      ]
    );

  const changeInWorkingCapital =
    getMillions(
      cashFlow,
      [
        "changeInWorkingCapital",
        "changesInWorkingCapital",
      ]
    );

  const unleveredFreeCashFlow =
    calculateUfcf(
      operatingIncome,
      depreciationAndAmortization,
      purchaseOfIntangibles,
      saleOfIntangibles,
      capex,
      changeInWorkingCapital
    );

  const dilutedAverageShares =
    getShares(
      financials,
      [
        "dilutedAverageShares",
        "weightedAverageSharesDiluted",
        "dilutedWeightedAverageShares",
      ]
    );

  const totalDebt =
    getMillions(
      balanceSheet,
      [
        "totalDebt",
        "totalDebtAndCapitalLeaseObligation",
        "longTermDebtAndCapitalLeaseObligation",
      ]
    );

  const cashAndShortTermInvestments =
    getMillions(
      balanceSheet,
      [
        "cashCashEquivalentsAndShortTermInvestments",
        "cashAndCashEquivalents",
        "cashFinancial",
        "cashShortTermInvestments",
      ]
    );

  const equity =
    getMillions(
      balanceSheet,
      [
        "stockholdersEquity",
        "totalStockholderEquity",
        "totalEquityGrossMinorityInterest",
        "commonStockEquity",
        "equity",
      ]
    );

  const netDebt =
    calculateNetDebt(
      totalDebt,
      cashAndShortTermInvestments
    );

  return {
    year,

    revenue: round(revenue),

    freeCashFlow:
      round(freeCashFlow),

    unleveredFreeCashFlow:
      round(
        unleveredFreeCashFlow
      ),

    operatingIncome:
      round(operatingIncome),

    taxProvision:
      round(taxProvision),

    pretaxIncome:
      round(pretaxIncome),

    equity:
      round(equity),

    totalDebt:
      round(totalDebt),

    cashAndShortTermInvestments:
      round(
        cashAndShortTermInvestments
      ),

    netDebt:
      round(netDebt),

    dilutedAverageShares:
      dilutedAverageShares === null
        ? null
        : round(
            dilutedAverageShares,
            0
          ),

    ufcfInputs: {
      EBIT:
        round(operatingIncome),

      depreciationAndAmortization:
        round(
          depreciationAndAmortization
        ),

      purchaseOfIntangibles:
        round(
          purchaseOfIntangibles
        ),

      saleOfIntangibles:
        round(
          saleOfIntangibles
        ),

      capitalExpenditure:
        round(capex),

      changeInWorkingCapital:
        round(
          changeInWorkingCapital
        ),
    },
  };
}

function buildEulerpoolAnnualRow(
  year: number,
  incomeStatement: any,
  cashFlow: any,
  balanceSheet: any
): AnnualRow {
  const revenue =
    getEulerMillions(
      incomeStatement,
      [
        "revenue",
        "totalRevenue",
        "salesRevenue",
        "sales",
        "revenues",
      ]
    );

  let freeCashFlow =
    getEulerMillions(
      cashFlow,
      [
        "freeCashFlow",
        "fcf",
      ]
    );

  if (freeCashFlow === null) {
    const operatingCashFlow =
      getEulerMillions(
        cashFlow,
        [
          "operatingCashFlow",
          "cashFlowFromOperatingActivities",
          "netCashProvidedByOperatingActivities",
          "totalCashFromOperatingActivities",
        ]
      );

    const capex =
      getEulerMillions(
        cashFlow,
        [
          "capitalExpenditure",
          "capex",
          "capitalExpenditures",
        ]
      );

    if (
      operatingCashFlow !== null &&
      capex !== null
    ) {
      freeCashFlow =
        operatingCashFlow -
        Math.abs(capex);
    }
  }

  const ebit =
    getEulerMillions(
      incomeStatement,
      [
        "ebit",
        "EBIT",
        "operatingIncome",
        "operatingProfit",
      ]
    );

  const pretaxIncome =
    getEulerMillions(
      incomeStatement,
      [
        "pretaxIncome",
        "preTaxIncome",
        "incomeBeforeTax",
      ]
    );

  const taxProvision =
    getEulerMillions(
      incomeStatement,
      [
        "taxProvision",
        "taxExpense",
        "incomeTaxExpense",
        "taxes",
      ]
    );

  const depreciationAndAmortization =
    getEulerMillions(
      incomeStatement,
      [
        "depreciationAndAmortization",
        "depreciationAmortization",
        "depreciation",
        "amortization",
      ]
    ) ??
    getEulerMillions(
      cashFlow,
      [
        "depreciationAndAmortization",
        "depreciationAmortization",
        "depreciation",
        "amortization",
      ]
    );

  const purchaseOfIntangibles =
    getEulerMillions(
      cashFlow,
      [
        "purchaseOfIntangibles",
        "purchaseOfIntangibleAssets",
        "acquisitionsOfIntangibleAssets",
      ]
    );

  const saleOfIntangibles =
    getEulerMillions(
      cashFlow,
      [
        "saleOfIntangibles",
        "saleOfIntangibleAssets",
        "proceedsFromSaleOfIntangibleAssets",
      ]
    );

  const capex =
    getEulerMillions(
      cashFlow,
      [
        "capitalExpenditure",
        "capex",
        "capitalExpenditures",
      ]
    );

  const changeInWorkingCapital =
    getEulerMillions(
      cashFlow,
      [
        "changeInWorkingCapital",
        "changesInWorkingCapital",
        "changeInNetWorkingCapital",
      ]
    );

  let unleveredFreeCashFlow =
    getEulerMillions(
      cashFlow,
      [
        "unleveredFreeCashFlow",
        "ufcf",
      ]
    );

  if (
    unleveredFreeCashFlow === null
  ) {
    unleveredFreeCashFlow =
      calculateUfcf(
        ebit,
        depreciationAndAmortization,
        purchaseOfIntangibles,
        saleOfIntangibles,
        capex,
        changeInWorkingCapital
      );
  }

  /*
   * CORRECTION IMPORTANTE :
   *
   * Eulerpool :
   * 504 = 504 millions d'actions
   *
   * Yahoo :
   * 497976118 = 497 976 118 actions
   *
   * On convertit donc Eulerpool en nombre d'actions.
   */
  const dilutedAverageShares =
    getEulerShares(
      incomeStatement,
      [
        "dilutedAverageShares",
        "dilutedShares",
        "weightedAverageSharesDiluted",
        "sharesDiluted",
        "shares",
      ]
    );

  const totalDebt =
    getEulerMillions(
      balanceSheet,
      [
        "totalDebt",
        "debt",
        "totalDebtAndCapitalLeaseObligation",
        "longTermDebt",
        "longTermDebtAndFinanceLeaseObligations",
      ]
    );

  const longTermDebt =
    getEulerMillions(
      balanceSheet,
      [
        "longTermDebt",
        "longTermDebtAndFinanceLeaseObligations",
        "longTermDebtAndCapitalLeaseObligation",
      ]
    );

  const shortTermDebt =
    getEulerMillions(
      balanceSheet,
      [
        "shortTermDebt",
        "currentDebt",
        "currentPortionOfLongTermDebt",
      ]
    );

  const finalTotalDebt =
    totalDebt !== null
      ? totalDebt
      : longTermDebt !== null ||
          shortTermDebt !== null
        ? (longTermDebt ?? 0) +
          (shortTermDebt ?? 0)
        : null;

  const cashAndShortTermInvestments =
    getEulerMillions(
      balanceSheet,
      [
        "cashAndCashEquivalents",
        "cashCashEquivalentsAndShortTermInvestments",
        "cashAndShortTermInvestments",
        "cashShortTermInvestments",
        "cash",
        "cashFinancial",
      ]
    );

  const equity =
    getEulerMillions(
      balanceSheet,
      [
        "stockholdersEquity",
        "totalStockholderEquity",
        "totalShareholderEquity",
        "shareholdersEquity",
        "commonStockEquity",
        "equity",
        "totalEquity",
      ]
    );

  const netDebt =
    calculateNetDebt(
      finalTotalDebt,
      cashAndShortTermInvestments
    );

  return {
    year,

    revenue:
      round(revenue),

    freeCashFlow:
      round(freeCashFlow),

    unleveredFreeCashFlow:
      round(
        unleveredFreeCashFlow
      ),

    operatingIncome:
      round(ebit),

    taxProvision:
      round(taxProvision),

    pretaxIncome:
      round(pretaxIncome),

    equity:
      round(equity),

    totalDebt:
      round(finalTotalDebt),

    cashAndShortTermInvestments:
      round(
        cashAndShortTermInvestments
      ),

    netDebt:
      round(netDebt),

    /*
     * La valeur est maintenant exprimée
     * dans la même unité que Yahoo Finance :
     * nombre réel d'actions.
     */
    dilutedAverageShares:
      dilutedAverageShares === null
        ? null
        : round(
            dilutedAverageShares,
            0
          ),

    ufcfInputs: {
      EBIT:
        round(ebit),

      depreciationAndAmortization:
        round(
          depreciationAndAmortization
        ),

      purchaseOfIntangibles:
        round(
          purchaseOfIntangibles
        ),

      saleOfIntangibles:
        round(
          saleOfIntangibles
        ),

      capitalExpenditure:
        round(capex),

      changeInWorkingCapital:
        round(
          changeInWorkingCapital
        ),
    },
  };
}

function calculateRoce(
  row: AnnualRow
) {
  if (
    row.operatingIncome === null ||
    row.taxProvision === null ||
    row.pretaxIncome === null ||
    row.equity === null ||
    row.totalDebt === null ||
    row.cashAndShortTermInvestments === null
  ) {
    return {
      year: row.year,
      taxRate: null,
      nopat: null,
      investedCapital: null,
      roce: null,
    };
  }

  if (
    row.pretaxIncome === 0
  ) {
    return {
      year: row.year,
      taxRate: null,
      nopat: null,
      investedCapital: null,
      roce: null,
    };
  }

  const taxRate =
    row.taxProvision /
    row.pretaxIncome;

  const nopat =
    row.operatingIncome *
    (1 - taxRate);

  const investedCapital =
    row.equity +
    row.totalDebt -
    row.cashAndShortTermInvestments;

  if (
    investedCapital === 0
  ) {
    return {
      year: row.year,
      taxRate:
        round(taxRate, 6),
      nopat:
        round(nopat),
      investedCapital: 0,
      roce: null,
    };
  }

  const roce =
    nopat / investedCapital;

  return {
    year: row.year,
    taxRate:
      round(taxRate, 6),
    nopat:
      round(nopat),
    investedCapital:
      round(investedCapital),
    roce:
      round(roce, 6),
  };
}

function calculateSuperRoic(
  annual: AnnualRow[]
) {
  const roceRows =
    annual
      .filter(
        (row) =>
          row.year >= 2021 &&
          row.year <= 2025
      )
      .map(calculateRoce);

  const validRoce =
    roceRows.filter(
      (row) =>
        row.roce !== null
    );

  if (
    validRoce.length === 0
  ) {
    return {
      value: null,
      yearsUsed: [],
      yearlyRoce: roceRows,
    };
  }

  const average =
    validRoce.reduce(
      (sum, row) =>
        sum +
        (row.roce ?? 0),
      0
    ) /
    validRoce.length;

  return {
    value:
      round(
        average,
        6
      ),

    yearsUsed:
      validRoce.map(
        (row) => row.year
      ),

    yearlyRoce:
      roceRows,
  };
}

function calculateRevenueGrowth(
  annual: AnnualRow[]
) {
  const sorted =
    [...annual].sort(
      (a, b) =>
        a.year - b.year
    );

  const first =
    sorted.find(
      (row) =>
        row.year === 2020
    );

  const last =
    sorted
      .filter(
        (row) =>
          row.revenue !== null
      )
      .at(-1);

  if (
    !first ||
    !last ||
    first.revenue === null ||
    last.revenue === null ||
    first.revenue <= 0 ||
    last.revenue <= 0
  ) {
    return null;
  }

  const years =
    last.year -
    first.year;

  if (years <= 0) {
    return null;
  }

  return round(
    (
      Math.pow(
        last.revenue /
          first.revenue,
        1 / years
      ) - 1
    ) * 100,
    2
  );
}

function calculateUfcfGrowth(
  annual: AnnualRow[]
) {
  const first =
    annual.find(
      (row) =>
        row.year === 2020
    );

  const last =
    [...annual]
      .sort(
        (a, b) =>
          a.year - b.year
      )
      .filter(
        (row) =>
          row.unleveredFreeCashFlow !==
          null
      )
      .at(-1);

  if (
    !first ||
    !last ||
    first.unleveredFreeCashFlow === null ||
    last.unleveredFreeCashFlow === null
  ) {
    return null;
  }

  if (
    first.unleveredFreeCashFlow <= 0 ||
    last.unleveredFreeCashFlow <= 0
  ) {
    return null;
  }

  const years =
    last.year -
    first.year;

  if (years <= 0) {
    return null;
  }

  return round(
    (
      Math.pow(
        last.unleveredFreeCashFlow /
          first.unleveredFreeCashFlow,
        1 / years
      ) - 1
    ) * 100,
    2
  );
}

function calculateDilutedSharesChange(
  annual: AnnualRow[]
) {
  const first =
    annual.find(
      (row) =>
        row.year === 2020
    );

  const last =
    [...annual]
      .sort(
        (a, b) =>
          a.year - b.year
      )
      .filter(
        (row) =>
          row.dilutedAverageShares !==
          null
      )
      .at(-1);

  if (
    !first ||
    !last ||
    first.dilutedAverageShares === null ||
    last.dilutedAverageShares === null
  ) {
    return null;
  }

  if (
    first.dilutedAverageShares <= 0
  ) {
    return null;
  }

  return round(
    (
      last.dilutedAverageShares /
        first.dilutedAverageShares -
      1
    ) * 100,
    2
  );
}

function calculateAverageFcfMargin(
  annual: AnnualRow[]
) {
  const rows =
    annual.filter(
      (row) =>
        row.year >= 2021 &&
        row.year <= 2025 &&
        row.freeCashFlow !== null &&
        row.revenue !== null &&
        row.revenue !== 0
    );

  if (
    rows.length === 0
  ) {
    return null;
  }

  const margins =
    rows.map(
      (row) =>
        (row.freeCashFlow! /
          row.revenue!) *
        100
    );

  const average =
    margins.reduce(
      (sum, value) =>
        sum + value,
      0
    ) /
    margins.length;

  return round(
    average,
    2
  );
}

function calculateNetDebtToUfcf(
  annual: AnnualRow[]
) {
  const latest =
    [...annual]
      .sort(
        (a, b) =>
          b.year - a.year
      )
      .find(
        (row) =>
          row.netDebt !== null &&
          row.unleveredFreeCashFlow !==
            null
      );

  if (
    !latest ||
    latest.netDebt === null ||
    latest.unleveredFreeCashFlow === null
  ) {
    return null;
  }

  if (
    latest.unleveredFreeCashFlow === 0
  ) {
    return null;
  }

  return round(
    latest.netDebt /
      latest.unleveredFreeCashFlow,
    2
  );
}

function calculateCriteria(
  annual: AnnualRow[]
) {
  return {
    revenueGrowth:
      calculateRevenueGrowth(
        annual
      ),

    ufcfGrowth:
      calculateUfcfGrowth(
        annual
      ),

    superRoic:
      calculateSuperRoic(
        annual
      ),

    netDebtToUfcf:
      calculateNetDebtToUfcf(
        annual
      ),

    dilutedSharesChange:
      calculateDilutedSharesChange(
        annual
      ),

    averageFcfMargin:
      calculateAverageFcfMargin(
        annual
      ),
  };
}

export async function GET() {
  try {
    const companies: Record<
      string,
      any
    > = {};

    for (
      const company of COMPANIES
    ) {
      const [
        eulerpoolIncome,
        eulerpoolCashFlow,
        eulerpoolBalanceSheet,
        yahoo,
      ] = await Promise.all([
        getEulerpool(
          "incomestatement",
          company.isin
        ),

        getEulerpool(
          "cashflowstatement",
          company.isin
        ),

        getEulerpool(
          "balancesheet",
          company.isin
        ),

        getYahooRows(
          company.symbol
        ),
      ]);

      const annual: AnnualRow[] =
        [];

      /*
       * 2020 = Eulerpool
       */
      const eulerpoolIncome2020 =
        findYearRow(
          eulerpoolIncome,
          2020
        );

      const eulerpoolCashFlow2020 =
        findYearRow(
          eulerpoolCashFlow,
          2020
        );

      const eulerpoolBalanceSheet2020 =
        findYearRow(
          eulerpoolBalanceSheet,
          2020
        );

      if (
        eulerpoolIncome2020 ||
        eulerpoolCashFlow2020 ||
        eulerpoolBalanceSheet2020
      ) {
        annual.push(
          buildEulerpoolAnnualRow(
            2020,
            eulerpoolIncome2020,
            eulerpoolCashFlow2020,
            eulerpoolBalanceSheet2020
          )
        );
      }

      /*
       * 2021 = Eulerpool
       */
      const eulerpoolIncome2021 =
        findYearRow(
          eulerpoolIncome,
          2021
        );

      const eulerpoolCashFlow2021 =
        findYearRow(
          eulerpoolCashFlow,
          2021
        );

      const eulerpoolBalanceSheet2021 =
        findYearRow(
          eulerpoolBalanceSheet,
          2021
        );

      if (
        eulerpoolIncome2021 ||
        eulerpoolCashFlow2021 ||
        eulerpoolBalanceSheet2021
      ) {
        annual.push(
          buildEulerpoolAnnualRow(
            2021,
            eulerpoolIncome2021,
            eulerpoolCashFlow2021,
            eulerpoolBalanceSheet2021
          )
        );
      }

      /*
       * 2022 → dernier exercice disponible
       * = Yahoo Finance
       */
      for (
        let year = 2022;
        year <= 2026;
        year++
      ) {
        const financials =
          findYahooYear(
            yahoo.financials,
            year
          );

        const cashFlow =
          findYahooYear(
            yahoo.cashFlow,
            year
          );

        const balanceSheet =
          findYahooYear(
            yahoo.balanceSheet,
            year
          );

        if (
          !financials &&
          !cashFlow &&
          !balanceSheet
        ) {
          continue;
        }

        annual.push(
          buildAnnualRow(
            year,
            financials,
            cashFlow,
            balanceSheet
          )
        );
      }

      annual.sort(
        (a, b) =>
          a.year - b.year
      );

      const latestAnnual =
        [...annual]
          .sort(
            (a, b) =>
              b.year - a.year
          )[0] ??
        null;

      const criteria =
        calculateCriteria(
          annual
        );

      const lvmhTargets =
        company.name === "LVMH"
          ? UFCF_TARGETS.LVMH
          : null;

      const validation =
        lvmhTargets
          ? annual
              .filter(
                (row) =>
                  lvmhTargets[
                    row.year as keyof typeof lvmhTargets
                  ] !==
                  undefined
              )
              .map((row) => {
                const target =
                  lvmhTargets[
                    row.year as keyof typeof lvmhTargets
                  ];

                const calculated =
                  row.unleveredFreeCashFlow;

                return {
                  year:
                    row.year,

                  targetUfcf:
                    target,

                  calculatedUfcf:
                    calculated,

                  difference:
                    calculated === null
                      ? null
                      : round(
                          calculated -
                            target
                        ),

                  differencePercent:
                    calculated === null
                      ? null
                      : round(
                          (
                            (
                              calculated -
                              target
                            ) /
                            target
                          ) *
                            100,
                          2
                        ),
                };
              })
          : [];

      companies[
        company.name
      ] = {
        company:
          company.name,

        isin:
          company.isin,

        symbol:
          company.symbol,

        annual,

        latestAnnual,

        criteria,

        validation,

        calculation: {
          ufcf:
            "EBIT × 0,625 + D&A + achats incorporels + ventes incorporelles − Capex + variation du BFR",

          revenueGrowth:
            "CAGR CA 2020 → dernier exercice disponible",

          ufcfGrowth:
            "CAGR UFCF 2020 → dernier exercice disponible",

          superRoic:
            "Moyenne des ROCE 2021 → 2025",

          roce:
            "NOPAT / Capital investi",

          taxRate:
            "Tax Provision / Pre-tax Income",

          nopat:
            "Operating Income × (1 − taux d'impôt)",

          investedCapital:
            "Equity + Total Debt − Cash & Short-Term Investments",

          netDebtToUfcf:
            "Dette nette du dernier bilan disponible / UFCF annuel le plus récent",

          dilutedShares:
            "(Actions diluées dernier exercice / Actions diluées 2020 − 1) × 100",

          dilutedSharesUnits:
            "Eulerpool 2020/2021 : millions d'actions × 1 000 000 ; Yahoo Finance 2022+ : nombre d'actions",

          averageFcfMargin:
            "Moyenne de FCF / CA sur 2021 → 2025",
        },
      };
    }

    return NextResponse.json({
      success: true,

      source: {
        historical2020:
          "Eulerpool",

        historical2021:
          "Eulerpool",

        historical2022toLatest:
          "Yahoo Finance",

        calculations:
          "Application",

        validation:
          "LVMH UFCF targets — diagnostic uniquement",
      },

      companies,
    });
  } catch (error) {
    console.error(
      "test-fundamentals error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}