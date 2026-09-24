import { NextResponse } from "next/server";

export async function GET() {
  try {
    const companies = {
      LVMH: {
        slug: "lvmh-moet-hennessy-louis-vuitton-mc-pa",
      },
      Hermès: {
        slug: "hermes-international-sca-rms-pa",
      },
    };

    const results: Record<string, any> = {};

    for (const [name, company] of Object.entries(companies)) {
      const baseUrl = `https://boersenlotse.de/aktien/${company.slug}/finanzen`;

      const urls = {
        guv: `${baseUrl}?export=csv&zeitraum=alle`,
        cashflow: `${baseUrl}?export=csv&statement=cashflow&zeitraum=alle`,
        balance: `${baseUrl}?export=csv&statement=balance&zeitraum=alle`,
      };

      const [
        guvResponse,
        cashflowResponse,
        balanceResponse,
      ] = await Promise.all([
        fetch(urls.guv, {
          cache: "no-store",
        }),

        fetch(urls.cashflow, {
          cache: "no-store",
        }),

        fetch(urls.balance, {
          cache: "no-store",
        }),
      ]);

      const [guv, cashflow, balance] =
        await Promise.all([
          guvResponse.text(),
          cashflowResponse.text(),
          balanceResponse.text(),
        ]);

      results[name] = {
        guv: {
          httpStatus: guvResponse.status,
          ok: guvResponse.ok,
          contentType:
            guvResponse.headers.get("content-type"),
          csv: guv,
        },

        cashflow: {
          httpStatus: cashflowResponse.status,
          ok: cashflowResponse.ok,
          contentType:
            cashflowResponse.headers.get("content-type"),
          csv: cashflow,
        },

        balance: {
          httpStatus: balanceResponse.status,
          ok: balanceResponse.ok,
          contentType:
            balanceResponse.headers.get("content-type"),
          csv: balance,
        },
      };
    }

    return NextResponse.json(results);
  } catch (error) {
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