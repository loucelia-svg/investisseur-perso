const BOERSENLOTSE_BASE =
  "https://boersenlotse.de/aktien";

const COMPANIES = {
  LVMH: "lvmh-moet-hennessy-louis-vuitton-mc-pa",
  Hermès: "hermes-international-sca-rms-pa",
} as const;

export type BoersenlotseHistoricalData = {
  year: number;

  // Compte de résultat
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  ebitda: number | null;

  // Cash-flow
  freeCashFlow: number | null;
  stockBasedCompensation: number | null;

  // Actions
  sharesOutstanding: number | null;

  // Bilan
  totalAssets: number | null;
  goodwill: number | null;
  currentLiabilities: number | null;
  cashAndShortTermInvestments: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
};

type ParsedCsv = {
  years: number[];
  rows: Map<string, (number | null)[]>;
};

/**
 * Parse une ligne CSV en respectant les champs entre guillemets.
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];

  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());

  return result;
}

/**
 * Convertit une cellule CSV en nombre.
 *
 * Les cellules vides restent null.
 */
function parseNumber(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/^"|"$/g, "");

  if (cleaned === "") {
    return null;
  }

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : null;
}

/**
 * Parse un CSV Börsenlotse.
 *
 * La première ligne contient les années.
 * Les lignes suivantes contiennent les différents indicateurs.
 */
function parseCsv(csv: string): ParsedCsv {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    throw new Error("CSV Börsenlotse vide.");
  }

  const header = parseCsvLine(lines[0]);

  const years = header
    .slice(1)
    .map((value) => Number(value))
    .filter((year) => Number.isFinite(year));

  const rows = new Map<string, (number | null)[]>();

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);

    const label = cells[0]?.trim();

    if (!label) {
      continue;
    }

    const values = cells
      .slice(1)
      .map(parseNumber);

    rows.set(label, values);
  }

  return {
    years,
    rows,
  };
}

/**
 * Télécharge un CSV Börsenlotse.
 *
 * Le résultat est mis en cache pendant 24 heures afin d'éviter
 * de télécharger plusieurs fois les mêmes données historiques.
 */
async function fetchCsv(url: string): Promise<string> {
  const response = await fetch(url, {
    next: {
      revalidate: 86400,
    },
  });

  if (response.status === 429) {
    throw new Error(
      "Börsenlotse limite temporairement les téléchargements. " +
        "Les données historiques sont protégées par un cache de 24 heures."
    );
  }

  if (!response.ok) {
    const text = await response.text();

    throw new Error(
      `Börsenlotse a répondu ${response.status} pour ${url}. ` +
        text.slice(0, 200)
    );
  }

  return response.text();
}

/**
 * Télécharge les trois états financiers historiques
 * d'une société :
 *
 * - compte de résultat
 * - cash-flow
 * - bilan
 */
async function fetchCompanyStatements(slug: string) {
  const baseUrl =
    `${BOERSENLOTSE_BASE}/${slug}/finanzen`;

  const guvUrl =
    `${baseUrl}?export=csv&zeitraum=alle`;

  const cashflowUrl =
    `${baseUrl}?export=csv&statement=cashflow&zeitraum=alle`;

  const balanceUrl =
    `${baseUrl}?export=csv&statement=balance&zeitraum=alle`;

  const guvCsv = await fetchCsv(guvUrl);
  const cashflowCsv = await fetchCsv(cashflowUrl);
  const balanceCsv = await fetchCsv(balanceUrl);

  return {
    guv: parseCsv(guvCsv),
    cashflow: parseCsv(cashflowCsv),
    balance: parseCsv(balanceCsv),
  };
}

/**
 * Récupère la valeur d'une ligne pour une année donnée.
 */
function getRowValue(
  rows: Map<string, (number | null)[]>,
  label: string,
  index: number
): number | null {
  const row = rows.get(label);

  if (!row) {
    return null;
  }

  return row[index] ?? null;
}

/**
 * Récupère toutes les données historiques d'une société.
 */
export async function getBoersenlotseHistoricalData(
  company: keyof typeof COMPANIES
): Promise<BoersenlotseHistoricalData[]> {
  const statements =
    await fetchCompanyStatements(COMPANIES[company]);

  const years = statements.guv.years;

  return years
    .map((year, index) => ({
      year,

      // Compte de résultat
      revenue: getRowValue(
        statements.guv.rows,
        "Umsatz",
        index
      ),

      grossProfit: getRowValue(
        statements.guv.rows,
        "Bruttogewinn",
        index
      ),

      operatingIncome: getRowValue(
        statements.guv.rows,
        "Operatives Ergebnis",
        index
      ),

      netIncome: getRowValue(
        statements.guv.rows,
        "Nettogewinn",
        index
      ),

      ebitda: getRowValue(
        statements.guv.rows,
        "EBITDA",
        index
      ),

      // Cash-flow
      freeCashFlow: getRowValue(
        statements.cashflow.rows,
        "Freier Cashflow",
        index
      ),

      stockBasedCompensation: getRowValue(
        statements.cashflow.rows,
        "Aktienbasierte Vergütung",
        index
      ),

      // Actions
      sharesOutstanding: getRowValue(
        statements.balance.rows,
        "Ausstehende Aktien",
        index
      ),

      // Bilan
      totalAssets: getRowValue(
        statements.balance.rows,
        "Bilanzsumme",
        index
      ),

      goodwill: getRowValue(
        statements.balance.rows,
        "Goodwill",
        index
      ),

      currentLiabilities: getRowValue(
        statements.balance.rows,
        "Kurzfristige Verbindlichkeiten",
        index
      ),

      cashAndShortTermInvestments: getRowValue(
        statements.balance.rows,
        "Zahlungsmittel & kurzfristige Anlagen",
        index
      ),

      shortTermDebt: getRowValue(
        statements.balance.rows,
        "Kurzfristige Finanzschulden",
        index
      ),

      longTermDebt: getRowValue(
        statements.balance.rows,
        "Langfristige Finanzschulden",
        index
      ),
    }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Récupère les données historiques de LVMH et Hermès.
 */
export async function getAllBoersenlotseHistoricalData() {
  const LVMH =
    await getBoersenlotseHistoricalData("LVMH");

  const Hermes =
    await getBoersenlotseHistoricalData("Hermès");

  return {
    LVMH,
    Hermès: Hermes,
  };
}