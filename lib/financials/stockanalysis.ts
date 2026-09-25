const STOCK_ANALYSIS_EPA_BASE =
  "https://stockanalysis.com/quote/epa";

const STOCK_ANALYSIS_US_BASE =
  "https://stockanalysis.com/stocks";

const EPA_TICKERS = new Set([
  "MC",
  "RMS",
]);

export type StockAnalysisBalanceSheet = {
  period: string;
  totalDebt: number | null;
  cashAndShortTermInvestments: number | null;
  netDebt: number | null;
};

export type StockAnalysisAnnualCashFlow = {
  year: number;
  unleveredFreeCashFlow: number | null;
};

/**
 * Données historiques du bilan utiles
 * au calcul du Super ROIC.
 */
export type StockAnalysisHistoricalBalanceSheet = {
  year: number;

  totalAssets: number | null;

  currentLiabilities: number | null;

  goodwill: number | null;

  equity: number | null;

  tangibleBookValue: number | null;

  totalDebt: number | null;

  cashAndShortTermInvestments: number | null;
};

export type StockAnalysisFinancialData = {
  balanceSheet: StockAnalysisBalanceSheet;

  annualCashFlow:
    StockAnalysisAnnualCashFlow;
};

/**
 * =========================================================
 * URL STOCKANALYSIS
 * =========================================================
 *
 * MC / RMS :
 * /quote/epa/...
 *
 * AAPL / MSFT / etc. :
 * /stocks/...
 */
function getStockAnalysisBaseUrl(
  ticker: string
): string {
  const normalizedTicker =
    ticker.trim().toUpperCase();

  if (
    EPA_TICKERS.has(
      normalizedTicker
    )
  ) {
    return (
      `${STOCK_ANALYSIS_EPA_BASE}/` +
      normalizedTicker
    );
  }

  return (
    `${STOCK_ANALYSIS_US_BASE}/` +
    normalizedTicker.toLowerCase()
  );
}

async function fetchStockAnalysisPage(
  ticker: string,
  page:
    | "balance-sheet"
    | "cash-flow-statement"
): Promise<string> {
  const companyBaseUrl =
    getStockAnalysisBaseUrl(
      ticker
    );

  const url =
    `${companyBaseUrl}/financials/${page}/`;

  const response =
    await fetch(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; InvestisseurPerso/1.0)",

          Accept:
            "text/html",
        },

        cache: "no-store",
      }
    );

  if (!response.ok) {
    throw new Error(
      `StockAnalysis ${response.status}: ${url}`
    );
  }

  return response.text();
}

/**
 * =========================================================
 * EXTRACTION TABLEAUX STOCKANALYSIS
 * =========================================================
 */
function extractArray(
  html: string,
  key: string
): string[] | null {
  const escapedKey =
    key.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

  const pattern =
    new RegExp(
      `${escapedKey}:\\[([^\\]]*)\\]`
    );

  const match =
    html.match(pattern);

  if (!match) {
    return null;
  }

  return match[1]
    .split(",")
    .map((value) =>
      value
        .trim()
        .replace(
          /^"|"$/g,
          ""
        )
        .replace(
          /^'|'$/g,
          ""
        )
    );
}

function parseNumber(
  value:
    | string
    | undefined
): number | null {
  if (
    value === undefined ||
    value === "" ||
    value === "null"
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function parseYear(
  value:
    | string
    | undefined
): number | null {
  if (!value) {
    return null;
  }

  const year =
    Number(value);

  if (
    !Number.isInteger(
      year
    ) ||
    year < 1900 ||
    year > 2200
  ) {
    return null;
  }

  return year;
}

/**
 * =========================================================
 * DERNIER BILAN
 * =========================================================
 */
function extractBalanceSheet(
  html: string
): StockAnalysisBalanceSheet {
  const debt =
    extractArray(
      html,
      "debt"
    );

  const totalCash =
    extractArray(
      html,
      "totalcash"
    );

  const dateKey =
    extractArray(
      html,
      "datekey"
    );

  if (!debt) {
    throw new Error(
      "Tableau StockAnalysis : donnée debt introuvable."
    );
  }

  if (!totalCash) {
    throw new Error(
      "Tableau StockAnalysis : donnée totalcash introuvable."
    );
  }

  const totalDebt =
    parseNumber(
      debt[0]
    );

  const cashAndShortTermInvestments =
    parseNumber(
      totalCash[0]
    );

  const netDebt =
    totalDebt !== null &&
    cashAndShortTermInvestments !==
      null
      ? totalDebt -
        cashAndShortTermInvestments
      : null;

  const period =
    dateKey?.[0] ??
    "Dernière période disponible";

  return {
    period,

    totalDebt,

    cashAndShortTermInvestments,

    netDebt,
  };
}

/**
 * =========================================================
 * UFCF ANNUEL
 * =========================================================
 */
function extractAnnualUnleveredFCF(
  html: string
): StockAnalysisAnnualCashFlow {
  const fiscalYear =
    extractArray(
      html,
      "fiscalYear"
    );

  const unleveredFCF =
    extractArray(
      html,
      "unleveredFCF"
    );

  if (!fiscalYear) {
    throw new Error(
      "StockAnalysis : tableau fiscalYear introuvable."
    );
  }

  if (!unleveredFCF) {
    throw new Error(
      "StockAnalysis : tableau unleveredFCF introuvable."
    );
  }

  const dateKey =
    extractArray(
      html,
      "datekey"
    );

  let annualIndex = -1;

  /**
   * On exclut TTM.
   *
   * Le premier véritable exercice annuel
   * disponible est utilisé.
   */
  for (
    let index = 0;
    index <
    fiscalYear.length;
    index++
  ) {
    const date =
      dateKey?.[index];

    if (
      date &&
      date !== "TTM" &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        date
      )
    ) {
      annualIndex =
        index;

      break;
    }
  }

  if (
    annualIndex === -1
  ) {
    throw new Error(
      "StockAnalysis : aucun exercice annuel UFCF trouvé."
    );
  }

  const year =
    parseYear(
      fiscalYear[
        annualIndex
      ]
    );

  if (year === null) {
    throw new Error(
      "StockAnalysis : année fiscale invalide."
    );
  }

  return {
    year,

    unleveredFreeCashFlow:
      parseNumber(
        unleveredFCF[
          annualIndex
        ]
      ),
  };
}

/**
 * =========================================================
 * HISTORIQUE BALANCE SHEET
 * =========================================================
 *
 * C'est cette fonction qui va désormais
 * nous permettre de compléter Yahoo pour
 * le Super ROIC.
 *
 * Elle récupère :
 *
 * - Total Assets
 * - Current Liabilities
 * - Goodwill
 * - Equity
 * - Tangible Book Value
 * - Total Debt
 * - Cash + Short-Term Investments
 *
 * TTM est volontairement exclu.
 */
function extractHistoricalBalanceSheet(
  html: string
): StockAnalysisHistoricalBalanceSheet[] {
  const fiscalYears =
    extractArray(
      html,
      "fiscalYear"
    );

  const dateKeys =
    extractArray(
      html,
      "datekey"
    );

  const assets =
    extractArray(
      html,
      "assets"
    );

  const currentLiabilities =
    extractArray(
      html,
      "currentLiabilities"
    );

  const goodwill =
    extractArray(
      html,
      "goodwill"
    );

  const equity =
    extractArray(
      html,
      "equity"
    );

  const tangibleBookValue =
    extractArray(
      html,
      "tangibleBookValue"
    );

  const debt =
    extractArray(
      html,
      "debt"
    );

  const totalCash =
    extractArray(
      html,
      "totalcash"
    );

  if (!fiscalYears) {
    throw new Error(
      "StockAnalysis : fiscalYear introuvable dans le bilan."
    );
  }

  if (!dateKeys) {
    throw new Error(
      "StockAnalysis : datekey introuvable dans le bilan."
    );
  }

  const rows:
    StockAnalysisHistoricalBalanceSheet[] =
    [];

  for (
    let index = 0;
    index <
    fiscalYears.length;
    index++
  ) {
    const date =
      dateKeys[index];

    /**
     * On ne veut jamais utiliser
     * la ligne TTM pour le Super ROIC.
     */
    if (
      !date ||
      date === "TTM"
    ) {
      continue;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(
        date
      )
    ) {
      continue;
    }

    const year =
      parseYear(
        fiscalYears[
          index
        ]
      );

    if (
      year === null
    ) {
      continue;
    }

    const rawGoodwill =
      parseNumber(
        goodwill?.[
          index
        ]
      );

    const rowEquity =
      parseNumber(
        equity?.[
          index
        ]
      );

    const rowTangibleBookValue =
      parseNumber(
        tangibleBookValue?.[
          index
        ]
      );

    /**
     * =====================================================
     * NORMALISATION GOODWILL
     * =====================================================
     *
     * Cas 1 :
     * StockAnalysis fournit directement
     * le Goodwill.
     *
     * Exemple :
     * Microsoft.
     *
     * Cas 2 :
     * Goodwill = null MAIS
     * Equity === Tangible Book Value.
     *
     * Cela nous donne une preuve comptable
     * suffisante pour normaliser le Goodwill
     * à zéro pour notre formule.
     *
     * Exemple :
     * Apple 2021-2025.
     *
     * Sinon :
     * on garde null.
     */
    let normalizedGoodwill:
      number | null =
      rawGoodwill;

    if (
      normalizedGoodwill ===
        null &&
      rowEquity !== null &&
      rowTangibleBookValue !==
        null &&
      Math.abs(
        rowEquity -
          rowTangibleBookValue
      ) < 1
    ) {
      normalizedGoodwill =
        0;
    }

    rows.push({
      year,

      totalAssets:
        parseNumber(
          assets?.[
            index
          ]
        ),

      currentLiabilities:
        parseNumber(
          currentLiabilities?.[
            index
          ]
        ),

      goodwill:
        normalizedGoodwill,

      equity:
        rowEquity,

      tangibleBookValue:
        rowTangibleBookValue,

      totalDebt:
        parseNumber(
          debt?.[
            index
          ]
        ),

      cashAndShortTermInvestments:
        parseNumber(
          totalCash?.[
            index
          ]
        ),
    });
  }

  /**
   * On trie du plus ancien
   * au plus récent.
   */
  return rows.sort(
    (a, b) =>
      a.year - b.year
  );
}

/**
 * =========================================================
 * API EXISTANTE
 * =========================================================
 *
 * Conservée pour ne pas casser
 * LVMH / Hermès.
 */
export async function getStockAnalysisFinancialData(
  ticker: string
): Promise<StockAnalysisFinancialData> {
  const normalizedTicker =
    ticker
      .trim()
      .toUpperCase();

  if (!normalizedTicker) {
    throw new Error(
      "Ticker StockAnalysis vide."
    );
  }

  const [
    balanceSheetHtml,
    cashFlowHtml,
  ] = await Promise.all([
    fetchStockAnalysisPage(
      normalizedTicker,
      "balance-sheet"
    ),

    fetchStockAnalysisPage(
      normalizedTicker,
      "cash-flow-statement"
    ),
  ]);

  return {
    balanceSheet:
      extractBalanceSheet(
        balanceSheetHtml
      ),

    annualCashFlow:
      extractAnnualUnleveredFCF(
        cashFlowHtml
      ),
  };
}

/**
 * =========================================================
 * NOUVELLE API HISTORIQUE GÉNÉRIQUE
 * =========================================================
 *
 * Exemple :
 *
 * const history =
 *   await getStockAnalysisHistoricalBalanceSheet(
 *     "AAPL"
 *   );
 *
 * Retour :
 *
 * [
 *   {
 *     year: 2021,
 *     totalAssets: ...,
 *     currentLiabilities: ...,
 *     goodwill: 0,
 *     ...
 *   },
 *   ...
 * ]
 */
export async function getStockAnalysisHistoricalBalanceSheet(
  ticker: string
): Promise<
  StockAnalysisHistoricalBalanceSheet[]
> {
  const normalizedTicker =
    ticker
      .trim()
      .toUpperCase();

  if (!normalizedTicker) {
    throw new Error(
      "Ticker StockAnalysis vide."
    );
  }

  const html =
    await fetchStockAnalysisPage(
      normalizedTicker,
      "balance-sheet"
    );

  return extractHistoricalBalanceSheet(
    html
  );
}

/**
 * =========================================================
 * DIAGNOSTIC — UFCF
 * =========================================================
 */
export async function debugStockAnalysisUnleveredFCF(
  ticker: string
): Promise<string[]> {
  const normalizedTicker =
    ticker
      .trim()
      .toUpperCase();

  const html =
    await fetchStockAnalysisPage(
      normalizedTicker,
      "cash-flow-statement"
    );

  const results:
    string[] = [];

  let startIndex = 0;

  while (true) {
    const index =
      html.indexOf(
        "unleveredFCF",
        startIndex
      );

    if (
      index === -1
    ) {
      break;
    }

    results.push(
      html.slice(
        Math.max(
          0,
          index - 1000
        ),
        index + 5000
      )
    );

    startIndex =
      index +
      "unleveredFCF".length;
  }

  return results;
}

/**
 * =========================================================
 * DIAGNOSTIC — COMPOSANTS UFCF
 * =========================================================
 */
export async function debugStockAnalysisUfcfComponents(
  ticker: string
): Promise<
  Record<
    string,
    string[] | null
  >
> {
  const normalizedTicker =
    ticker
      .trim()
      .toUpperCase();

  const html =
    await fetchStockAnalysisPage(
      normalizedTicker,
      "cash-flow-statement"
    );

  const keys = [
    "fiscalYear",
    "datekey",
    "ncfo",
    "capex",
    "fcf",
    "fcfAfterLeases",
    "leveredFCF",
    "unleveredFCF",
    "cashInterestPaid",
    "cashTaxesPaid",
    "changeWorkingCapital",
    "netIncomeCF",
    "totalDepAmorCF",
    "otherAmortization",
    "debtIssuedLongTerm",
    "debtRepaidLongTerm",
    "netDebtIssued",
    "operatingLeasePayments",
    "otherfinancing",
  ];

  const result: Record<
    string,
    string[] | null
  > = {};

  for (
    const key of keys
  ) {
    result[key] =
      extractArray(
        html,
        key
      );
  }

  return result;
}

/**
 * =========================================================
 * DIAGNOSTIC — FORMULE UFCF
 * =========================================================
 */
export async function debugStockAnalysisUfcfFormula(
  ticker: string
): Promise<
  Record<
    string,
    string[] | null
  >
> {
  const normalizedTicker =
    ticker
      .trim()
      .toUpperCase();

  const html =
    await fetchStockAnalysisPage(
      normalizedTicker,
      "cash-flow-statement"
    );

  const candidateKeys =
    new Set<string>();

  const keyPattern =
    /([A-Za-z][A-Za-z0-9]*):\[/g;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      keyPattern.exec(
        html
      )) !== null
  ) {
    candidateKeys.add(
      match[1]
    );
  }

  const keywords = [
    "fcf",
    "cash",
    "flow",
    "lease",
    "interest",
    "tax",
    "income",
    "operating",
    "working",
    "capital",
    "receiv",
    "invent",
    "payable",
    "accrued",
    "depreciation",
    "amort",
    "impair",
    "noncash",
    "gain",
    "loss",
    "stock",
    "compensation",
    "sharebased",
    "basedcomp",
    "dividend",
    "repurch",
    "debt",
    "financing",
    "investing",
    "equity",
    "minority",
    "noncontrolling",
    "payment",
    "proceeds",
    "asset",
    "liabil",
    "deferred",
    "other",
  ];

  const relevantKeys =
    [...candidateKeys]
      .filter((key) => {
        const lower =
          key.toLowerCase();

        return keywords.some(
          (keyword) =>
            lower.includes(
              keyword
                .toLowerCase()
            )
        );
      })
      .sort();

  const result: Record<
    string,
    string[] | null
  > = {};

  for (
    const key of relevantKeys
  ) {
    result[key] =
      extractArray(
        html,
        key
      );
  }

  return result;
}

/**
 * =========================================================
 * DIAGNOSTIC — BALANCE SHEET
 * =========================================================
 */
export async function debugStockAnalysisBalanceSheet(
  ticker: string
): Promise<
  Record<
    string,
    string[] | null
  >
> {
  const normalizedTicker =
    ticker
      .trim()
      .toUpperCase();

  if (!normalizedTicker) {
    throw new Error(
      "Ticker StockAnalysis vide."
    );
  }

  const html =
    await fetchStockAnalysisPage(
      normalizedTicker,
      "balance-sheet"
    );

  const candidateKeys =
    new Set<string>();

  const keyPattern =
    /([A-Za-z][A-Za-z0-9]*):\[/g;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      keyPattern.exec(
        html
      )) !== null
  ) {
    candidateKeys.add(
      match[1]
    );
  }

  const keywords = [
    "asset",
    "goodwill",
    "intangible",
    "liabil",
    "cash",
    "debt",
    "current",
    "equity",
    "book",
    "tangible",
  ];

  const relevantKeys =
    [...candidateKeys]
      .filter((key) => {
        const lower =
          key.toLowerCase();

        return keywords.some(
          (keyword) =>
            lower.includes(
              keyword
                .toLowerCase()
            )
        );
      })
      .sort();

  const result: Record<
    string,
    string[] | null
  > = {};

  result.fiscalYear =
    extractArray(
      html,
      "fiscalYear"
    );

  result.datekey =
    extractArray(
      html,
      "datekey"
    );

  for (
    const key of relevantKeys
  ) {
    result[key] =
      extractArray(
        html,
        key
      );
  }

  return result;
}