import { NextResponse } from "next/server";

const EULERPOOL_BASE =
  "https://api.eulerpool.com/api/1";

async function fetchEulerpool(
  endpoint: string,
  apiKey: string
) {
  const response = await fetch(
    `${EULERPOOL_BASE}${endpoint}?token=${encodeURIComponent(
      apiKey
    )}`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${await response.text()}`
    );
  }

  return response.json();
}

function find2020(
  data: unknown
) {
  if (!Array.isArray(data)) {
    return null;
  }

  return (
    data.find(
      (row) =>
        row &&
        typeof row === "object" &&
        String(
          (row as Record<string, unknown>)
            .period
        ).startsWith("2020")
    ) ?? null
  );
}

export async function GET() {
  const apiKey =
    process.env.EULERPOOL_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "EULERPOOL_API_KEY absente",
      },
      { status: 500 }
    );
  }

  try {
    const companies = [
      {
        name: "LVMH",
        isin: "FR0000121014",
      },
      {
        name: "Hermes",
        isin: "FR0000052292",
      },
    ];

    const results: Record<
      string,
      unknown
    > = {};

    for (const company of companies) {
      const [
        income,
        balance,
        cashflow,
      ] = await Promise.all([
        fetchEulerpool(
          `/equity/incomestatement/${company.isin}`,
          apiKey
        ),
        fetchEulerpool(
          `/equity/balancesheet/${company.isin}`,
          apiKey
        ),
        fetchEulerpool(
          `/equity/cashflowstatement/${company.isin}`,
          apiKey
        ),
      ]);

      results[company.name] = {
        income2020:
          find2020(income),

        balance2020:
          find2020(balance),

        cashflow2020:
          find2020(cashflow),
      };
    }

    return NextResponse.json({
      ok: true,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}