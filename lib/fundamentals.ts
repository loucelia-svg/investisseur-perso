import YahooFinance from "yahoo-finance2";
const yahooFinance = new YahooFinance();
export type HistoricalFundamental = {
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
type CompanyKey = "LVMH" | "Hermès";
type YahooRow = {
  date?: Date | string;
  totalRevenue?: number | null;
  grossProfit?: number | null;
  operatingIncome?: number | null;
  freeCashFlow?: number | null;
  unleveredFreeCashFlow?: number | null;
  totalAssets?: number | null;
  goodwill?: number | null;
  currentLiabilities?: number | null;
  totalDebt?: number | null;
  cashAndCashEquivalents?: number | null;
  cashCashEquivalentsAndShortTermInvestments?: number | null;
  endCashPosition?: number | null;
  dilutedAverageShares?: number | null;
  ordinarySharesNumber?: number | null;
  shareIssued?: number | null;
  fullTimeEmployees?: number | null;
  stockBasedCompensation?: number | null;
};
type Statement =
  | "guv"
  | "balance"
  | "cashflow"
  | "kennzahlen";
const BOERSENLOTSE_BASE = "https://boersenlotse.de/aktien";
const BOERSENLOTSE_SYMBOLS: Record<CompanyKey, string> = {
  LVMH: "lvmh-moet-hennessy-louis-vuitton-mc-pa",
  Hermès: "hermes-international-sca-rms-pa",
};
function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}
function getYear(value: Date | string | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getUTCFullYear();
}
function firstNumber(
  ...values: Array<number | null | undefined>
): number | null {
  for (const value of values) {
    const normalized = numberOrNull(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
}
function mergeValue(
  current: number | null,
  previous: number | null
): number | null {
  return current !== null ? current : previous;
}
function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
function cleanHtmlCell(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}
/**
 * Börsenlotse affiche les montants financiers en millions d'euros.
 *
 * Exemple :
 * 12.229 -> 12 229 millions -> 12 229 000 000 €
 * -410   -> -410 millions   -> -410 000 000 €
 */
function parseBoersenlotseValue(
  value: string | undefined
): number | null {
  if (!value) return null;
  let text = decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    !text ||
    text === "–" ||
    text === "-" ||
    text === "—" ||
    text.toLowerCase() === "n/a"
  ) {
    return null;
  }
  text = text
    .replace(/EUR/gi, "")
    .replace(/€+/g, "")
    .replace(/%/g, "")
    .trim();
  const negative =
    text.startsWith("-") ||
    text.startsWith("−") ||
    /^\(.*\)$/.test(text);
  text = text
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .replace(/^[-−+]/, "")
    .trim();
  if (!text) {
    return null;
  }
  if (text.includes(",")) {
    const parts = text.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      text = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      text = text.replace(/[.,]/g, "");
    }
  } else {
    text = text.replace(/\./g, "");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return (negative ? -parsed : parsed) * 1_000_000;
}
function parseBoersenlotsePerShare(
  value: string | undefined
): number | null {
  if (!value) return null;
  let text = decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    !text ||
    text === "–" ||
    text === "-" ||
    text === "—" ||
    text.toLowerCase() === "n/a"
  ) {
    return null;
  }
  text = text
    .replace(/EUR/gi, "")
    .replace(/€+/g, "")
    .trim();
  const negative =
    text.startsWith("-") ||
    text.startsWith("−") ||
    /^\(.*\)$/.test(text);
  text = text
    .replace(/^\(/, "")
    .replace(/\)$/, "")
    .replace(/^[-−+]/, "")
    .trim();
  if (!text) return null;
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}
function parseBoersenlotseShares(
  value: string | undefined
): number | null {
  if (!value) return null;
  let text = decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\u202f/g, " ")
    .trim();
  if (
    !text ||
    text === "–" ||
    text === "-" ||
    text === "—"
  ) {
    return null;
  }
  text = text.replace(/[^\d,.\-−]/g, "");
  if (!text) return null;
  const negative =
    text.startsWith("-") ||
    text.startsWith("−");
  text = text.replace(/^[-−]/, "");
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/\./g, "");
  }
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return negative ? -parsed : parsed;
}
function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowMatches =
    html.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
  for (const rowHtml of rowMatches) {
    const cells =
      rowHtml.match(
        /<(?:td|th)\b[\s\S]*?<\/(?:td|th)>/gi
      ) ?? [];
    if (cells.length === 0) {
      continue;
    }
    const cleaned = cells.map(cleanHtmlCell);
    if (cleaned.length >= 2) {
      rows.push(cleaned);
    }
  }
  return rows;
}
function findRow(
  rows: string[][],
  aliases: string[]
): string[] | null {
  const normalizedAliases = aliases.map(normalizeLabel);
  for (const row of rows) {
    const label = normalizeLabel(row[0] ?? "");
    if (!label) continue;
    const found = normalizedAliases.some((alias) => {
      if (label === alias) {
        return true;
      }
      return (
        label.includes(alias) ||
        alias.includes(label)
      );
    });
    if (found) {
      return row;
    }
  }
  return null;
}
function findYears(rows: string[][]): number[] {
  const years = new Set<number>();
  for (const row of rows) {
    for (const cell of row) {
      const match = cell.match(
        /\b(19\d{2}|20\d{2})\b/
      );
      if (!match) continue;
      const year = Number(match[1]);
      if (year >= 1900 && year <= 2100) {
        years.add(year);
      }
    }
  }
  return Array.from(years).sort(
    (a, b) => a - b
  );
}
function rowToYearValues(
  years: number[],
  row: string[] | null,
  parser: (
    value: string | undefined
  ) => number | null
): Map<number, number | null> {
  const result = new Map<
    number,
    number | null
  >();
  if (!row) {
    return result;
  }
  for (
    let index = 0;
    index < years.length;
    index++
  ) {
    const year = years[index];
    const value = row[index + 1];
    result.set(
      year,
      parser(value)
    );
  }
  return result;
}
function setField(
  target: Map<
    number,
    HistoricalFundamental
  >,
  year: number,
  field: Exclude<
    keyof HistoricalFundamental,
    "year"
  >,
  value: number | null
) {
  const existing = target.get(year);
  if (!existing) {
    return;
  }
  existing[field] = value;
}
async function fetchBoersenlotseStatement(
  boersenlotseSlug: string,
  label: string,
  statement: Statement
): Promise<
  Map<number, HistoricalFundamental>
> {
  const symbol = boersenlotseSlug;
  const url =
    `${BOERSENLOTSE_BASE}/${symbol}/finanzen` +
    `?statement=${statement}&zeitraum=alle`;
  console.log(
    `📚 Börsenlotse ${label} ${statement}: ${url}`
  );
  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; InvestisseurPerso/1.0)",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        `⚠️ Börsenlotse ${label} ${statement}: HTTP ${response.status}`
      );
      return new Map();
    }
    const html = await response.text();
    console.log(
      `📄 Börsenlotse ${label} ${statement}: ${html.length} caractères`
    );
    const rows =
      extractTableRows(html);
    const years =
      findYears(rows);
    console.log(
      `📅 Börsenlotse ${label} ${statement}:`,
      years.length > 0
        ? `${years[0]} → ${
            years[years.length - 1]
          }`
        : "aucune année trouvée"
    );
    if (years.length === 0) {
      return new Map();
    }
    const result =
      new Map<
        number,
        HistoricalFundamental
      >();
    for (const year of years) {
      result.set(year, {
        year,
        revenue: null,
        grossProfit: null,
        operatingIncome: null,
        freeCashFlow: null,
        unleveredFreeCashFlow: null,
        totalAssets: null,
        goodwill: null,
        currentLiabilities: null,
        shortTermDebt: null,
        longTermDebt: null,
        totalDebt: null,
        cash: null,
        cashAndShortTermInvestments: null,
        dilutedShares: null,
        employees: null,
        stockBasedCompensation: null,
      });
    }
    if (statement === "guv") {
      const revenueRow =
        findRow(rows, [
          "Umsatz",
          "Revenue",
          "Total Revenue",
        ]);
      const grossProfitRow =
        findRow(rows, [
          "Bruttogewinn",
          "Bruttoergebnis",
          "Gross Profit",
        ]);
      const operatingIncomeRow =
        findRow(rows, [
          "Operatives Ergebnis",
          "Betriebsergebnis",
          "Operating Income",
          "Operating Profit",
          "EBIT",
        ]);
      const revenue =
        rowToYearValues(
          years,
          revenueRow,
          parseBoersenlotseValue
        );
      const grossProfit =
        rowToYearValues(
          years,
          grossProfitRow,
          parseBoersenlotseValue
        );
      const operatingIncome =
        rowToYearValues(
          years,
          operatingIncomeRow,
          parseBoersenlotseValue
        );
      for (const year of years) {
        setField(
          result,
          year,
          "revenue",
          revenue.get(year) ?? null
        );
        setField(
          result,
          year,
          "grossProfit",
          grossProfit.get(year) ?? null
        );
        setField(
          result,
          year,
          "operatingIncome",
          operatingIncome.get(year) ?? null
        );
      }
    }
    if (statement === "balance") {
      const totalAssetsRow =
        findRow(rows, [
          "Bilanzsumme",
          "Gesamtvermögen",
          "Gesamtvermogen",
          "Total Assets",
        ]);
      const goodwillRow =
        findRow(rows, [
          "Geschäfts- oder Firmenwert",
          "Geschafts- oder Firmenwert",
          "Geschäfts-/Firmenwert",
          "Geschafts-/Firmenwert",
          "Goodwill",
        ]);
      const currentLiabilitiesRow =
        findRow(rows, [
          "Kurzfristige Verbindlichkeiten",
          "Current Liabilities",
          "Kurzfristige Schulden",
        ]);
      const shortTermDebtRow =
        findRow(rows, [
          "Kurzfristige Finanzschulden",
          "Kurzfristige Finanzverbindlichkeiten",
          "Short Term Financial Debt",
          "Short-Term Financial Debt",
          "Short Term Debt",
          "Short-Term Debt",
        ]);
      const longTermDebtRow =
        findRow(rows, [
          "Langfristige Finanzschulden",
          "Langfristige Finanzverbindlichkeiten",
          "Long Term Financial Debt",
          "Long-Term Financial Debt",
          "Long Term Debt",
          "Long-Term Debt",
        ]);
      const cashRow =
        findRow(rows, [
          "Zahlungsmittel",
          "Cash and Cash Equivalents",
          "Cash & Cash Equivalents",
        ]);
      const cashAndShortTermInvestmentsRow =
        findRow(rows, [
          "Zahlungsmittel & kurzfristige Anlagen",
          "Zahlungsmittel und kurzfristige Anlagen",
          "Cash and Short Term Investments",
          "Cash & Short Term Investments",
          "Cash and Short-Term Investments",
          "Cash & Short-Term Investments",
        ]);
      const totalAssets =
        rowToYearValues(
          years,
          totalAssetsRow,
          parseBoersenlotseValue
        );
      const goodwill =
        rowToYearValues(
          years,
          goodwillRow,
          parseBoersenlotseValue
        );
      const currentLiabilities =
        rowToYearValues(
          years,
          currentLiabilitiesRow,
          parseBoersenlotseValue
        );
      const shortTermDebt =
        rowToYearValues(
          years,
          shortTermDebtRow,
          parseBoersenlotseValue
        );
      const longTermDebt =
        rowToYearValues(
          years,
          longTermDebtRow,
          parseBoersenlotseValue
        );
      const cash =
        rowToYearValues(
          years,
          cashRow,
          parseBoersenlotseValue
        );
      const cashAndShortTermInvestments =
        rowToYearValues(
          years,
          cashAndShortTermInvestmentsRow,
          parseBoersenlotseValue
        );
      for (const year of years) {
        const shortDebt =
          shortTermDebt.get(year) ?? null;
        const longDebt =
          longTermDebt.get(year) ?? null;
        let totalDebt: number | null = null;
        if (
          shortDebt !== null ||
          longDebt !== null
        ) {
          totalDebt =
            (shortDebt ?? 0) +
            (longDebt ?? 0);
        }
        setField(
          result,
          year,
          "totalAssets",
          totalAssets.get(year) ?? null
        );
        setField(
          result,
          year,
          "goodwill",
          goodwill.get(year) ?? null
        );
        setField(
          result,
          year,
          "currentLiabilities",
          currentLiabilities.get(year) ?? null
        );
        setField(
          result,
          year,
          "shortTermDebt",
          shortDebt
        );
        setField(
          result,
          year,
          "longTermDebt",
          longDebt
        );
        setField(
          result,
          year,
          "totalDebt",
          totalDebt
        );
        setField(
          result,
          year,
          "cash",
          cash.get(year) ?? null
        );
        setField(
          result,
          year,
          "cashAndShortTermInvestments",
          cashAndShortTermInvestments.get(
            year
          ) ?? null
        );
      }
    }
    if (statement === "cashflow") {
      const freeCashFlowRow =
        findRow(rows, [
          "Freier Cashflow",
          "Free Cash Flow",
          "Free Cashflow",
          "FCF",
        ]);
      const unleveredFreeCashFlowRow =
        findRow(rows, [
          "Unlevered Free Cash Flow",
          "Unlevered Free Cashflow",
          "Unlevered Free Cash Flow",
        ]);
      const stockBasedCompensationRow =
        findRow(rows, [
          "Aktienbasierte Vergütung",
          "Aktienbasierte Vergutung",
          "Stock Based Compensation",
          "Stock-Based Compensation",
          "Stock compensation",
        ]);
      const freeCashFlow =
        rowToYearValues(
          years,
          freeCashFlowRow,
          parseBoersenlotseValue
        );
      const unleveredFreeCashFlow =
        rowToYearValues(
          years,
          unleveredFreeCashFlowRow,
          parseBoersenlotseValue
        );
      const stockBasedCompensation =
        rowToYearValues(
          years,
          stockBasedCompensationRow,
          parseBoersenlotseValue
        );
      for (const year of years) {
        setField(
          result,
          year,
          "freeCashFlow",
          freeCashFlow.get(year) ?? null
        );
        setField(
          result,
          year,
          "unleveredFreeCashFlow",
          unleveredFreeCashFlow.get(
            year
          ) ?? null
        );
        setField(
          result,
          year,
          "stockBasedCompensation",
          stockBasedCompensation.get(
            year
          ) ?? null
        );
      }
    }
    if (statement === "kennzahlen") {
      const employeesRow =
        findRow(rows, [
          "Mitarbeiter",
          "Mitarbeiterzahl",
          "Beschäftigte",
          "Beschaftigte",
          "Employees",
          "Full Time Employees",
        ]);
      const dilutedSharesRow =
        findRow(rows, [
          "Verwässerte Aktien",
          "Verwasserte Aktien",
          "Verwässerte durchschnittliche Aktien",
          "Verwasserte durchschnittliche Aktien",
          "Diluted Shares",
          "Diluted Average Shares",
        ]);
      const employees =
        rowToYearValues(
          years,
          employeesRow,
          parseBoersenlotseValue
        );
      const dilutedShares =
        rowToYearValues(
          years,
          dilutedSharesRow,
          parseBoersenlotseShares
        );
      for (const year of years) {
        setField(
          result,
          year,
          "employees",
          employees.get(year) ?? null
        );
        setField(
          result,
          year,
          "dilutedShares",
          dilutedShares.get(year) ?? null
        );
      }
    }
    return result;
  } catch (error) {
    console.error(
      `❌ Börsenlotse ${label} ${statement}:`,
      error
    );
    return new Map();
  }
}
async function fetchBoersenlotseFcfPerShare(
  boersenlotseSlug: string,
  label: string
): Promise<Map<number, number | null>> {
  const symbol = boersenlotseSlug;
  const url =
    `${BOERSENLOTSE_BASE}/${symbol}/finanzen` +
    `?ansicht=je-aktie&statement=cashflow&zeitraum=alle`;
  console.log(`📚 Börsenlotse ${label} FCF/action: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; InvestisseurPerso/1.0)",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(
        `⚠️ Börsenlotse ${label} FCF/action: HTTP ${response.status}`
      );
      return new Map();
    }
    const html = await response.text();
    const rows = extractTableRows(html);
    const years = findYears(rows);
    const freeCashFlowPerShareRow = findRow(rows, [
      "Free Cashflow je Aktie",
      "Free Cash Flow je Aktie",
      "Freier Cashflow je Aktie",
      "Free Cash Flow per Share",
      "FCF je Aktie",
      "FCF per Share",
    ]);
    return rowToYearValues(
      years,
      freeCashFlowPerShareRow,
      parseBoersenlotsePerShare
    );
  } catch (error) {
    console.error(`❌ Börsenlotse ${label} FCF/action:`, error);
    return new Map();
  }
}
function slugifyBoersenlotseName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function buildBoersenlotseSlugCandidates(
  companyName: string,
  ticker: string
): string[] {
  const legalSuffixes = new Set([
    "inc",
    "incorporated",
    "corp",
    "corporation",
    "company",
    "co",
    "ltd",
    "limited",
    "plc",
    "sa",
    "se",
    "ag",
    "nv",
    "spa",
    "sarl",
    "holding",
    "holdings",
    "group",
    "class",
  ]);
  const tickerLower = ticker.toLowerCase();
  const fullSlug = slugifyBoersenlotseName(companyName);
  const words = fullSlug.split("-").filter(Boolean);
  const withoutSuffixes = words.filter(
    (word) => !legalSuffixes.has(word)
  );
  const candidates = new Set<string>();
  if (withoutSuffixes.length > 0) {
    candidates.add(
      `${withoutSuffixes.join("-")}-${tickerLower}`
    );
  }
  if (words.length > 0) {
    candidates.add(`${words.join("-")}-${tickerLower}`);
    candidates.add(`${words[0]}-${tickerLower}`);
    if (words.length >= 2) {
      candidates.add(
        `${words.slice(0, 2).join("-")}-${tickerLower}`
      );
    }
    if (words.length >= 3) {
      candidates.add(
        `${words.slice(0, 3).join("-")}-${tickerLower}`
      );
    }
  }
  return Array.from(candidates);
}
async function isValidBoersenlotseSlug(
  slug: string,
  ticker: string
): Promise<boolean> {
  const url =
    `${BOERSENLOTSE_BASE}/${slug}/finanzen?statement=guv&zeitraum=alle`;
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; InvestisseurPerso/1.0)",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (!response.ok) {
      return false;
    }
    const html = await response.text();
    const rows = extractTableRows(html);
    const years = findYears(rows);
    const normalizedHtml = normalizeLabel(html);
    return (
      years.length > 5 &&
      normalizedHtml.includes(
        normalizeLabel(ticker)
      )
    );
  } catch {
    return false;
  }
}
async function resolveBoersenlotseSlug(
  yahooSymbol: string
): Promise<string | null> {
  const normalizedSymbol =
    yahooSymbol.trim().toUpperCase();
  const ticker =
    normalizedSymbol.split(".")[0];
  const compact = normalizedSymbol
    .toLowerCase()
    .replace(".", "-");
  const knownSlug =
    Object.values(BOERSENLOTSE_SYMBOLS).find(
      (slug) => slug.endsWith(`-${compact}`)
    ) ?? null;
  if (knownSlug) {
    return knownSlug;
  }
  const comparisonUrl =
    `${BOERSENLOTSE_BASE}/vergleich?tickers=${encodeURIComponent(ticker)}`;
  try {
    const response = await fetch(comparisonUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "Mozilla/5.0 (compatible; InvestisseurPerso/1.0)",
      },
      cache: "no-store",
      redirect: "follow",
    });
    if (response.ok) {
      const html = await response.text();
      const patterns = [
        /href=["'](?:https?:\/\/[^"']+)?\/aktien\/([^"'/?#]+)(?:\/|["'?#])/gi,
        /["']\/aktien\/([^"'/?#]+)["']/gi,
      ];
      const slugs = new Set<string>();
      for (const pattern of patterns) {
        for (const match of html.matchAll(pattern)) {
          const slug = match[1];
          if (
            slug &&
            slug !== "vergleich" &&
            slug !== "screener"
          ) {
            slugs.add(slug);
          }
        }
      }
      const tickerLower = ticker.toLowerCase();
      const exact =
        Array.from(slugs).find(
          (slug) =>
            slug === tickerLower ||
            slug.endsWith(`-${tickerLower}`)
        ) ?? null;
      if (
        exact &&
        await isValidBoersenlotseSlug(
          exact,
          ticker
        )
      ) {
        console.log(
          `🔎 Börsenlotse ${normalizedSymbol}: ${exact} (comparateur)`
        );
        return exact;
      }
    }
  } catch (error) {
    console.error(
      `⚠️ Börsenlotse comparateur indisponible pour ${normalizedSymbol}:`,
      error
    );
  }
  try {
    const quote =
      await yahooFinance.quote(
        normalizedSymbol
      );
    const companyNames = [
      typeof quote.longName === "string"
        ? quote.longName
        : null,
      typeof quote.shortName === "string"
        ? quote.shortName
        : null,
    ].filter(
      (value): value is string =>
        Boolean(value)
    );
    const candidates = new Set<string>();
    for (const companyName of companyNames) {
      for (
        const candidate of
        buildBoersenlotseSlugCandidates(
          companyName,
          ticker
        )
      ) {
        candidates.add(candidate);
      }
    }
    for (const candidate of candidates) {
      if (
        await isValidBoersenlotseSlug(
          candidate,
          ticker
        )
      ) {
        console.log(
          `🔎 Börsenlotse ${normalizedSymbol}: ${candidate} (nom Yahoo)`
        );
        return candidate;
      }
    }
  } catch (error) {
    console.error(
      `⚠️ Résolution du nom Yahoo impossible pour ${normalizedSymbol}:`,
      error
    );
  }
  console.error(
    `⚠️ Börsenlotse: aucune fiche historique identifiée pour ${normalizedSymbol}`
  );
  return null;
}
async function fetchYahooModule(
  symbol: string,
  module:
    | "financials"
    | "cash-flow"
    | "balance-sheet",
  period1: string,
  period2: string
): Promise<YahooRow[]> {
  try {
    console.log(
      `📊 Yahoo ${module} ${symbol}: ${period1} → ${period2}`
    );
    const result =
      await yahooFinance.fundamentalsTimeSeries(
        symbol,
        {
          period1,
          period2,
          type: "annual",
          module,
        }
      );
    if (!Array.isArray(result)) {
      return [];
    }
    return result as YahooRow[];
  } catch (error) {
    console.error(
      `⚠️ Yahoo ${module} ${symbol} ${period1} → ${period2}`,
      error
    );
    return [];
  }
}
export async function getYahooHistoricalFundamentals(
  symbol: string
): Promise<HistoricalFundamental[]> {
  const currentYear =
    new Date().getUTCFullYear();
  /**
   * Börsenlotse reste la source historique principale.
   * Yahoo sert uniquement de complément pour les années récentes.
   */
  const START_YEAR = 1980;
  const CHUNK_YEARS = 4;
  const periods: Array<{
    period1: string;
    period2: string;
  }> = [];
  for (
    let startYear = START_YEAR;
    startYear <= currentYear;
    startYear += CHUNK_YEARS
  ) {
    const endYear = Math.min(
      startYear + CHUNK_YEARS,
      currentYear + 1
    );
    periods.push({
      period1: `${startYear}-01-01`,
      period2: `${endYear}-01-01`,
    });
  }
  const chunks = await Promise.all(
    periods.map(
      async ({ period1, period2 }) => {
        const [
          financialRows,
          cashFlowRows,
          balanceSheetRows,
        ] = await Promise.all([
          fetchYahooModule(
            symbol,
            "financials",
            period1,
            period2
          ),
          fetchYahooModule(
            symbol,
            "cash-flow",
            period1,
            period2
          ),
          fetchYahooModule(
            symbol,
            "balance-sheet",
            period1,
            period2
          ),
        ]);
        return [
          ...financialRows,
          ...cashFlowRows,
          ...balanceSheetRows,
        ];
      }
    )
  );
  const allRows =
    chunks.flat();
  return mergeYahooRows(allRows);
}
function mergeYahooRows(
  rows: YahooRow[]
): HistoricalFundamental[] {
  const byYear =
    new Map<
      number,
      HistoricalFundamental
    >();
  for (const row of rows) {
    const year =
      getYear(row.date);
    if (year === null) {
      continue;
    }
    const current: HistoricalFundamental = {
      year,
      revenue:
        numberOrNull(row.totalRevenue),
      grossProfit:
        numberOrNull(row.grossProfit),
      operatingIncome:
        numberOrNull(row.operatingIncome),
      freeCashFlow:
        numberOrNull(row.freeCashFlow),
      unleveredFreeCashFlow:
        numberOrNull(
          row.unleveredFreeCashFlow
        ),
      totalAssets:
        numberOrNull(row.totalAssets),
      goodwill:
        numberOrNull(row.goodwill),
      currentLiabilities:
        numberOrNull(
          row.currentLiabilities
        ),
      shortTermDebt: null,
      longTermDebt: null,
      totalDebt:
        numberOrNull(row.totalDebt),
      cash:
        firstNumber(
          row.cashAndCashEquivalents,
          row.endCashPosition
        ),
      cashAndShortTermInvestments:
        firstNumber(
          row.cashCashEquivalentsAndShortTermInvestments,
          row.cashAndCashEquivalents,
          row.endCashPosition
        ),
      dilutedShares:
        firstNumber(
          row.dilutedAverageShares,
          row.ordinarySharesNumber,
          row.shareIssued
        ),
      employees:
        numberOrNull(
          row.fullTimeEmployees
        ),
      stockBasedCompensation:
        numberOrNull(
          row.stockBasedCompensation
        ),
    };
    const previous =
      byYear.get(year);
    if (!previous) {
      byYear.set(
        year,
        current
      );
      continue;
    }
    byYear.set(year, {
      year,
      revenue:
        mergeValue(
          current.revenue,
          previous.revenue
        ),
      grossProfit:
        mergeValue(
          current.grossProfit,
          previous.grossProfit
        ),
      operatingIncome:
        mergeValue(
          current.operatingIncome,
          previous.operatingIncome
        ),
      freeCashFlow:
        mergeValue(
          current.freeCashFlow,
          previous.freeCashFlow
        ),
      unleveredFreeCashFlow:
        mergeValue(
          current.unleveredFreeCashFlow,
          previous.unleveredFreeCashFlow
        ),
      totalAssets:
        mergeValue(
          current.totalAssets,
          previous.totalAssets
        ),
      goodwill:
        mergeValue(
          current.goodwill,
          previous.goodwill
        ),
      currentLiabilities:
        mergeValue(
          current.currentLiabilities,
          previous.currentLiabilities
        ),
      shortTermDebt:
        mergeValue(
          current.shortTermDebt,
          previous.shortTermDebt
        ),
      longTermDebt:
        mergeValue(
          current.longTermDebt,
          previous.longTermDebt
        ),
      totalDebt:
        mergeValue(
          current.totalDebt,
          previous.totalDebt
        ),
      cash:
        mergeValue(
          current.cash,
          previous.cash
        ),
      cashAndShortTermInvestments:
        mergeValue(
          current.cashAndShortTermInvestments,
          previous.cashAndShortTermInvestments
        ),
      dilutedShares:
        mergeValue(
          current.dilutedShares,
          previous.dilutedShares
        ),
      employees:
        mergeValue(
          current.employees,
          previous.employees
        ),
      stockBasedCompensation:
        mergeValue(
          current.stockBasedCompensation,
          previous.stockBasedCompensation
        ),
    });
  }
  return Array.from(
    byYear.values()
  ).sort(
    (a, b) => a.year - b.year
  );
}
function mergeSources(
  primary: HistoricalFundamental[],
  fallback: HistoricalFundamental[]
): HistoricalFundamental[] {
  const byYear =
    new Map<
      number,
      HistoricalFundamental
    >();
  for (const row of primary) {
    byYear.set(
      row.year,
      { ...row }
    );
  }
  for (const row of fallback) {
    const existing =
      byYear.get(row.year);
    if (!existing) {
      byYear.set(
        row.year,
        { ...row }
      );
      continue;
    }
    byYear.set(row.year, {
      year: row.year,
      revenue:
        mergeValue(
          existing.revenue,
          row.revenue
        ),
      grossProfit:
        mergeValue(
          existing.grossProfit,
          row.grossProfit
        ),
      operatingIncome:
        mergeValue(
          existing.operatingIncome,
          row.operatingIncome
        ),
      freeCashFlow:
        mergeValue(
          existing.freeCashFlow,
          row.freeCashFlow
        ),
      unleveredFreeCashFlow:
        mergeValue(
          existing.unleveredFreeCashFlow,
          row.unleveredFreeCashFlow
        ),
      totalAssets:
        mergeValue(
          existing.totalAssets,
          row.totalAssets
        ),
      goodwill:
        mergeValue(
          existing.goodwill,
          row.goodwill
        ),
      currentLiabilities:
        mergeValue(
          existing.currentLiabilities,
          row.currentLiabilities
        ),
      shortTermDebt:
        mergeValue(
          existing.shortTermDebt,
          row.shortTermDebt
        ),
      longTermDebt:
        mergeValue(
          existing.longTermDebt,
          row.longTermDebt
        ),
      totalDebt:
        mergeValue(
          existing.totalDebt,
          row.totalDebt
        ),
      cash:
        mergeValue(
          existing.cash,
          row.cash
        ),
      cashAndShortTermInvestments:
        mergeValue(
          existing.cashAndShortTermInvestments,
          row.cashAndShortTermInvestments
        ),
      dilutedShares:
        mergeValue(
          existing.dilutedShares,
          row.dilutedShares
        ),
      employees:
        mergeValue(
          existing.employees,
          row.employees
        ),
      stockBasedCompensation:
        mergeValue(
          existing.stockBasedCompensation,
          row.stockBasedCompensation
        ),
    });
  }
  return Array.from(
    byYear.values()
  ).sort(
    (a, b) => a.year - b.year
  );
}
async function getHistoricalFundamentalsFromBoersenlotseAndYahoo(
  label: string,
  yahooSymbol: string,
  boersenlotseSlug: string | null
): Promise<HistoricalFundamental[]> {
  const boersenlotsePromises = boersenlotseSlug
    ? Promise.all([
        fetchBoersenlotseStatement(boersenlotseSlug, label, "guv"),
        fetchBoersenlotseStatement(boersenlotseSlug, label, "balance"),
        fetchBoersenlotseStatement(boersenlotseSlug, label, "cashflow"),
        fetchBoersenlotseStatement(boersenlotseSlug, label, "kennzahlen"),
        fetchBoersenlotseFcfPerShare(boersenlotseSlug, label),
      ])
    : Promise.resolve([
        new Map<number, HistoricalFundamental>(),
        new Map<number, HistoricalFundamental>(),
        new Map<number, HistoricalFundamental>(),
        new Map<number, HistoricalFundamental>(),
        new Map<number, number | null>(),
      ] as const);
  const [
    [guv, balance, cashflow, kennzahlen, fcfPerShare],
    yahooRows,
  ] = await Promise.all([
    boersenlotsePromises,
    getYahooHistoricalFundamentals(yahooSymbol),
  ]);
  const years = new Set<number>();
  for (const map of [guv, balance, cashflow, kennzahlen]) {
    for (const year of map.keys()) {
      years.add(year);
    }
  }
  const boersenlotseRows = Array.from(years)
    .sort((a, b) => a - b)
    .map((year) => {
      const base: HistoricalFundamental = {
        year,
        revenue: null,
        grossProfit: null,
        operatingIncome: null,
        freeCashFlow: null,
        unleveredFreeCashFlow: null,
        totalAssets: null,
        goodwill: null,
        currentLiabilities: null,
        shortTermDebt: null,
        longTermDebt: null,
        totalDebt: null,
        cash: null,
        cashAndShortTermInvestments: null,
        dilutedShares: null,
        employees: null,
        stockBasedCompensation: null,
      };
      for (const map of [guv, balance, cashflow, kennzahlen]) {
        const row = map.get(year);
        if (!row) continue;
        base.revenue = mergeValue(base.revenue, row.revenue);
        base.grossProfit = mergeValue(base.grossProfit, row.grossProfit);
        base.operatingIncome =
          mergeValue(base.operatingIncome, row.operatingIncome);
        base.freeCashFlow =
          mergeValue(base.freeCashFlow, row.freeCashFlow);
        base.unleveredFreeCashFlow =
          mergeValue(
            base.unleveredFreeCashFlow,
            row.unleveredFreeCashFlow
          );
        base.totalAssets =
          mergeValue(base.totalAssets, row.totalAssets);
        base.goodwill =
          mergeValue(base.goodwill, row.goodwill);
        base.currentLiabilities =
          mergeValue(base.currentLiabilities, row.currentLiabilities);
        base.shortTermDebt =
          mergeValue(base.shortTermDebt, row.shortTermDebt);
        base.longTermDebt =
          mergeValue(base.longTermDebt, row.longTermDebt);
        base.totalDebt =
          mergeValue(base.totalDebt, row.totalDebt);
        base.cash = mergeValue(base.cash, row.cash);
        base.cashAndShortTermInvestments =
          mergeValue(
            base.cashAndShortTermInvestments,
            row.cashAndShortTermInvestments
          );
        base.dilutedShares =
          mergeValue(base.dilutedShares, row.dilutedShares);
        base.employees =
          mergeValue(base.employees, row.employees);
        base.stockBasedCompensation =
          mergeValue(
            base.stockBasedCompensation,
            row.stockBasedCompensation
          );
      }
      if (
        base.dilutedShares === null &&
        base.freeCashFlow !== null
      ) {
        const perShare = fcfPerShare.get(year) ?? null;
        if (
          perShare !== null &&
          Number.isFinite(perShare) &&
          perShare !== 0
        ) {
          const derivedShares = base.freeCashFlow / perShare;
          if (
            Number.isFinite(derivedShares) &&
            derivedShares > 0
          ) {
            base.dilutedShares = derivedShares;
          }
        }
      }
      if (
        base.shortTermDebt !== null ||
        base.longTermDebt !== null
      ) {
        base.totalDebt =
          (base.shortTermDebt ?? 0) +
          (base.longTermDebt ?? 0);
      }
      return base;
    });
  console.log(
    `📚 Börsenlotse ${label}:`,
    boersenlotseRows.length > 0
      ? `${boersenlotseRows[0].year} → ${
          boersenlotseRows[boersenlotseRows.length - 1].year
        }`
      : "aucune donnée"
  );
  const merged = mergeSources(boersenlotseRows, yahooRows);
  console.log(
    `✅ Historique final ${label}:`,
    merged.length > 0
      ? `${merged[0].year} → ${
          merged[merged.length - 1].year
        } (${merged.length} années)`
      : "aucune donnée"
  );
  return merged;
}
async function getCompanyHistoricalFundamentals(
  company: CompanyKey,
  yahooSymbol: string
): Promise<HistoricalFundamental[]> {
  return getHistoricalFundamentalsFromBoersenlotseAndYahoo(
    company,
    yahooSymbol,
    BOERSENLOTSE_SYMBOLS[company]
  );
}
export async function getHistoricalFundamentalsForSymbol(
  yahooSymbol: string
): Promise<HistoricalFundamental[]> {
  const normalizedSymbol = yahooSymbol.trim().toUpperCase();
  const boersenlotseSlug =
    await resolveBoersenlotseSlug(normalizedSymbol);
  return getHistoricalFundamentalsFromBoersenlotseAndYahoo(
    normalizedSymbol,
    normalizedSymbol,
    boersenlotseSlug
  );
}
export async function getHistoricalFundamentalsForCharts() {
  const [
    lvmh,
    hermes,
  ] = await Promise.all([
    getCompanyHistoricalFundamentals(
      "LVMH",
      "MC.PA"
    ),
    getCompanyHistoricalFundamentals(
      "Hermès",
      "RMS.PA"
    ),
  ]);
  return {
    LVMH: lvmh,
    Hermès: hermes,
  };
}
