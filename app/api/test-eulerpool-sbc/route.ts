import { NextResponse } from "next/server";

const BOERSENLOTSE_BASE =
  "https://boersenlotse.de/aktien";

const LVMH_SLUG =
  "lvmh-moet-hennessy-louis-vuitton-mc-pa";

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

function cleanValue(value: string): string | number | null {
  const cleaned = value
    .trim()
    .replace(/^"|"$/g, "");

  if (cleaned === "") {
    return null;
  }

  const number = Number(cleaned);

  if (Number.isFinite(number)) {
    return number;
  }

  return cleaned;
}

export async function GET() {
  try {
    const url =
      `${BOERSENLOTSE_BASE}/${LVMH_SLUG}/finanzen` +
      `?export=csv&statement=cashflow&zeitraum=alle`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();

      return NextResponse.json(
        {
          error:
            `Börsenlotse a répondu ${response.status}`,
          details: text.slice(0, 1000),
          url,
        },
        { status: response.status }
      );
    }

    const csv = await response.text();

    const lines = csv
      .replace(/^\uFEFF/, "")
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "");

    if (lines.length === 0) {
      return NextResponse.json(
        {
          error: "CSV Börsenlotse vide.",
          url,
        },
        { status: 500 }
      );
    }

    const header = parseCsvLine(lines[0]);

    // Recherche des colonnes 2024 et 2025.
    const yearIndexes: Record<string, number> = {};

    for (let i = 0; i < header.length; i++) {
      const value = header[i]
        ?.trim()
        .replace(/^"|"$/g, "");

      if (value === "2024") {
        yearIndexes["2024"] = i;
      }

      if (value === "2025") {
        yearIndexes["2025"] = i;
      }
    }

    // Mots-clés volontairement larges pour ne rien rater.
    const keywords = [
      "aktien",
      "vergütung",
      "verguetung",
      "stock",
      "compensation",
      "share",
      "based",
      "option",
      "equity",
      "mitarbeiter",
      "employee",
      "aktie",
    ];

    const matchingRows = [];

    for (const line of lines.slice(1)) {
      const cells = parseCsvLine(line);

      const label =
        cells[0]
          ?.trim()
          .replace(/^"|"$/g, "") || "";

      const normalizedLabel =
        label.toLowerCase();

      const matches =
        keywords.some((keyword) =>
          normalizedLabel.includes(keyword)
        );

      if (!matches) {
        continue;
      }

      const value2024 =
        yearIndexes["2024"] !== undefined
          ? cleanValue(
              cells[yearIndexes["2024"]] ?? ""
            )
          : null;

      const value2025 =
        yearIndexes["2025"] !== undefined
          ? cleanValue(
              cells[yearIndexes["2025"]] ?? ""
            )
          : null;

      matchingRows.push({
        label,
        value2024,
        value2025,
      });
    }

    return NextResponse.json({
      company: "LVMH",
      ticker: "MC.PA",
      url,
      columns: {
        "2024": yearIndexes["2024"] ?? null,
        "2025": yearIndexes["2025"] ?? null,
      },
      matchingRows,
      totalMatchingRows: matchingRows.length,
    });
  } catch (error) {
    console.error(
      "Erreur diagnostic Börsenlotse SBC :",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}