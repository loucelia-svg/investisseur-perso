import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

type YahooSearchQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  quoteType?: string;
  typeDisp?: string;
  isYahooFinance?: boolean;
};

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl.searchParams;

    const query =
      searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Aucune entreprise à rechercher.",
          results: [],
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await yahooFinance.search(
        query,
        {
          quotesCount: 10,
          newsCount: 0,
        }
      );

    const quotes =
      Array.isArray(result.quotes)
        ? (
            result.quotes as YahooSearchQuote[]
          )
        : [];

    const companies = quotes
      .filter((quote) => {
        const quoteType =
          quote.quoteType?.toUpperCase();

        return (
          quote.symbol &&
          (
            quoteType === "EQUITY" ||
            quoteType === "ETF"
          )
        );
      })
      .map((quote) => ({
        symbol: quote.symbol ?? "",
        name:
          quote.longname ??
          quote.shortname ??
          quote.symbol ??
          "",
        shortName:
          quote.shortname ?? null,
        longName:
          quote.longname ?? null,
        exchange:
          quote.exchDisp ??
          quote.exchange ??
          null,
        quoteType:
          quote.quoteType ?? null,
      }));

    return NextResponse.json({
      success: true,
      query,
      results: companies,
    });
  } catch (error) {
    console.error(
      "Erreur recherche entreprise :",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue.",
        results: [],
      },
      {
        status: 500,
      }
    );
  }
}