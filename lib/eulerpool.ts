const EULERPOOL_BASE =
  "https://api.eulerpool.com/api/1";

const EULERPOOL_API_KEY =
  process.env.EULERPOOL_API_KEY;

type EulerpoolRecord = {
  [key: string]: unknown;
};

/**
 * Les ISIN utilisés dans Investisseur Perso.
 */
const ISINS = {
  LVMH: "FR0000121014",
  Hermès: "FR0000052292",
} as const;

/**
 * Vérifie qu'une valeur est un nombre exploitable.
 */
function asNumber(
  value: unknown
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }

  return null;
}

/**
 * Normalise une année provenant de différents
 * formats possibles de l'API Eulerpool.
 */
function extractYear(
  record: EulerpoolRecord
): number | null {
  const possibleDates = [
    record.period,
    record.fiscalYearEnd,
    record.fiscal_year_end,
    record.periodEndingDate,
    record.period_ending_date,
    record.date,
  ];

  for (const value of possibleDates) {
    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      const year = Math.trunc(value);

      if (
        year >= 1900 &&
        year <= 2100
      ) {
        return year;
      }
    }

    if (typeof value === "string") {
      const match =
        value.match(/\b(19|20)\d{2}\b/);

      if (match) {
        return Number(match[0]);
      }
    }
  }

  return null;
}

/**
 * Recherche récursivement les objets contenant
 * une donnée de Stock-Based Compensation.
 *
 * Cela rend le parseur tolérant à la structure
 * exacte renvoyée par l'API Eulerpool.
 */
function collectSbcRecords(
  value: unknown,
  result: Map<number, number>
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSbcRecords(
        item,
        result
      );
    }

    return;
  }

  if (
    value === null ||
    typeof value !== "object"
  ) {
    return;
  }

  const record =
    value as EulerpoolRecord;

  const sbcKeys = [
    "stockBasedCompensation",
    "stock_based_compensation",
    "StockBasedCompensation",
  ];

  let sbc: number | null = null;

  for (const key of sbcKeys) {
    if (key in record) {
      sbc = asNumber(record[key]);

      if (sbc !== null) {
        break;
      }
    }
  }

  if (sbc !== null) {
    const year =
      extractYear(record);

    if (year !== null) {
      result.set(year, sbc);
    }
  }

  for (const child of Object.values(
    record
  )) {
    if (
      child !== null &&
      typeof child === "object"
    ) {
      collectSbcRecords(
        child,
        result
      );
    }
  }
}

/**
 * Récupère l'historique du SBC via Eulerpool.
 *
 * L'API officielle expose les cash-flow statements
 * historiques par ISIN.
 */
export async function getEulerpoolSbcHistory(
  isin: string
): Promise<Map<number, number>> {
  if (!EULERPOOL_API_KEY) {
    console.warn(
      "EULERPOOL_API_KEY absente. " +
        "Impossible de récupérer le SBC Eulerpool."
    );

    return new Map();
  }

  const url =
    `${EULERPOOL_BASE}/equity/cash_flow_statement/${isin}`;

  const response =
    await fetch(url, {
      headers: {
        Authorization:
          `Bearer ${EULERPOOL_API_KEY}`,
        Accept:
          "application/json",
      },

      next: {
        revalidate: 86400,
      },
    });

  if (!response.ok) {
    const text =
      await response.text();

    console.error(
      `Eulerpool SBC ${response.status}:`,
      text.slice(0, 500)
    );

    return new Map();
  }

  const data =
    await response.json();

  const result =
    new Map<number, number>();

  collectSbcRecords(
    data,
    result
  );

  return result;
}

/**
 * Récupère les SBC de LVMH et Hermès.
 *
 * Les appels sont séquentiels afin de rester
 * raisonnables vis-à-vis de l'API.
 */
export async function getAllEulerpoolSbcHistory() {
  const LVMH =
    await getEulerpoolSbcHistory(
      ISINS.LVMH
    );

  const Hermes =
    await getEulerpoolSbcHistory(
      ISINS.Hermès
    );

  return {
    LVMH,
    Hermès: Hermes,
  };
}