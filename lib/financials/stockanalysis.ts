const STOCK_ANALYSIS_BASE =
  "https://stockanalysis.com/quote/epa";

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

export type StockAnalysisFinancialData = {
  balanceSheet: StockAnalysisBalanceSheet;
  annualCashFlow: StockAnalysisAnnualCashFlow;
};

async function fetchStockAnalysisPage(
  ticker: string,
  page:
    | "balance-sheet"
    | "cash-flow-statement"
): Promise<string> {
  const url =
    `${STOCK_ANALYSIS_BASE}/${ticker}/financials/${page}/`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; InvestisseurPerso/1.0)",
      Accept: "text/html",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `StockAnalysis ${response.status}: ${url}`
    );
  }

  return response.text();
}

function extractArray(
  html: string,
  key: string
): string[] | null {
  const pattern = new RegExp(
    `${key}:\\[([^\\]]*)\\]`
  );

  const match = html.match(pattern);

  if (!match) {
    return null;
  }

  return match[1]
    .split(",")
    .map((value) =>
      value
        .trim()
        .replace(/^"|"$/g, "")
        .replace(/^'|'$/g, "")
    );
}

function parseNumber(
  value: string | undefined
): number | null {
  if (
    value === undefined ||
    value === "" ||
    value === "null"
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function extractBalanceSheet(
  html: string
): StockAnalysisBalanceSheet {
  const debt = extractArray(
    html,
    "debt"
  );

  const totalCash = extractArray(
    html,
    "totalcash"
  );

  const dateKey = extractArray(
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
    parseNumber(debt[0]);

  const cashAndShortTermInvestments =
    parseNumber(totalCash[0]);

  const netDebt =
    totalDebt !== null &&
    cashAndShortTermInvestments !== null
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

function extractAnnualUnleveredFCF(
  html: string
): StockAnalysisAnnualCashFlow {
  const fiscalYear = extractArray(
    html,
    "fiscalYear"
  );

  const unleveredFCF = extractArray(
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

  const dateKey = extractArray(
    html,
    "datekey"
  );

  let annualIndex = -1;

  if (dateKey) {
    for (
      let i = 0;
      i < fiscalYear.length;
      i++
    ) {
      const date =
        dateKey[i] ?? "";

      if (
        /^\d{4}-\d{2}-\d{2}$/.test(date)
      ) {
        annualIndex = i;
        break;
      }
    }
  }

  if (annualIndex === -1) {
    annualIndex = 1;
  }

  const yearValue =
    fiscalYear[annualIndex];

  const year = Number(
    yearValue
  );

  if (!Number.isFinite(year)) {
    throw new Error(
      "StockAnalysis : année fiscale invalide."
    );
  }

  const unleveredFreeCashFlow =
    parseNumber(
      unleveredFCF[annualIndex]
    );

  return {
    year,
    unleveredFreeCashFlow,
  };
}

export async function getStockAnalysisFinancialData(
  ticker: string
): Promise<StockAnalysisFinancialData> {
  const normalizedTicker =
    ticker.trim().toUpperCase();

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
 * DIAGNOSTIC TEMPORAIRE
 *
 * Cherche toutes les occurrences de
 * "unleveredFCF" dans la page Cash Flow.
 */
export async function debugStockAnalysisUnleveredFCF(
  ticker: string
): Promise<string[]> {
  const normalizedTicker =
    ticker.trim().toUpperCase();

  const html =
    await fetchStockAnalysisPage(
      normalizedTicker,
      "cash-flow-statement"
    );

  const results: string[] = [];

  let startIndex = 0;

  while (true) {
    const index =
      html.indexOf(
        "unleveredFCF",
        startIndex
      );

    if (index === -1) {
      break;
    }

    results.push(
      html.slice(
        Math.max(0, index - 1000),
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
 * DIAGNOSTIC TEMPORAIRE
 *
 * Extrait les composants financiers que
 * StockAnalysis expose autour du calcul de l'UFCF.
 *
 * IMPORTANT :
 * Cette fonction ne calcule encore rien.
 * Elle sert uniquement à récupérer les données
 * afin que nous puissions déterminer la formule
 * utilisée par StockAnalysis.
 */
export async function debugStockAnalysisUfcfComponents(
  ticker: string
): Promise<Record<string, string[] | null>> {
  const normalizedTicker =
    ticker.trim().toUpperCase();

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

  for (const key of keys) {
    result[key] =
      extractArray(
        html,
        key
      );
  }

  return result;
}

/**
 * DIAGNOSTIC TEMPORAIRE
 *
 * Recherche automatiquement les données susceptibles
 * d'intervenir dans le calcul de Levered FCF /
 * Unlevered FCF.
 *
 * Cette version élargit volontairement la recherche
 * aux éléments :
 *
 * - non-cash
 * - rémunération en actions
 * - impôts différés
 * - gains / pertes
 * - dépréciations
 * - actifs / passifs
 * - working capital
 * - leases
 * - intérêts
 * - financement
 * - investissements
 *
 * IMPORTANT :
 * Cette fonction ne calcule encore rien.
 */
export async function debugStockAnalysisUfcfFormula(
  ticker: string
): Promise<Record<string, string[] | null>> {
  const normalizedTicker =
    ticker.trim().toUpperCase();

  const html =
    await fetchStockAnalysisPage(
      normalizedTicker,
      "cash-flow-statement"
    );

  /*
   * 1. Détection de toutes les clés présentes
   * dans les tableaux sérialisés de StockAnalysis.
   */
  const candidateKeys =
    new Set<string>();

  const keyPattern =
    /([A-Za-z][A-Za-z0-9]*):\[/g;

  let match: RegExpExecArray | null;

  while (
    (match = keyPattern.exec(html)) !== null
  ) {
    candidateKeys.add(match[1]);
  }

  /*
   * 2. Mots-clés recherchés.
   *
   * On ajoute volontairement plusieurs variantes
   * pour éviter de dépendre du nom exact choisi
   * par StockAnalysis.
   */
  const keywords = [
    // FCF
    "fcf",

    // Cash-flow
    "cash",
    "flow",

    // Leases
    "lease",

    // Intérêts
    "interest",

    // Fiscalité
    "tax",

    // Résultat
    "income",

    // Opérationnel
    "operating",

    // Working capital
    "working",
    "capital",
    "receiv",
    "invent",
    "payable",
    "accrued",

    // Amortissements / dépréciations
    "depreciation",
    "amort",
    "impair",

    // Non-cash
    "noncash",
    "nonCash",

    // Gains / pertes
    "gain",
    "loss",

    // Stock-based compensation
    "stock",
    "compensation",
    "shareBased",
    "basedComp",

    // Dividendes / rachats
    "dividend",
    "repurch",

    // Dette
    "debt",

    // Financement
    "financing",

    // Investissements
    "investing",

    // Capitaux propres
    "equity",

    // Intérêts minoritaires
    "minority",
    "nonControlling",

    // Paiements / encaissements
    "payment",
    "proceeds",

    // Actifs / passifs
    "asset",
    "liabil",

    // Différés
    "deferred",

    // Autres éléments
    "other",
  ];

  /*
   * 3. On conserve les clés pertinentes.
   */
  const relevantKeys =
    [...candidateKeys]
      .filter((key) => {
        const lower =
          key.toLowerCase();

        return keywords.some(
          (keyword) =>
            lower.includes(
              keyword.toLowerCase()
            )
        );
      })
      .sort();

  /*
   * 4. Extraction des valeurs.
   */
  const result: Record<
    string,
    string[] | null
  > = {};

  for (const key of relevantKeys) {
    result[key] =
      extractArray(
        html,
        key
      );
  }

  return result;
}