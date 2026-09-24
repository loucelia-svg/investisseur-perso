import { NextResponse } from "next/server";

export async function GET() {
  try {
    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "FMP_API_KEY absente",
        },
        { status: 500 }
      );
    }

    const symbol = "MC.PA";

    const url =
      `https://financialmodelingprep.com/stable/income-statement` +
      `?symbol=${symbol}` +
      `&period=annual` +
      `&limit=100` +
      `&apikey=${apiKey}`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    const text = await response.text();

    return NextResponse.json({
      httpStatus: response.status,
      ok: response.ok,
      response: text,
    });
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