import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "Le symbole est obligatoire" },
        { status: 400 }
      );
    }

    const apiKey = process.env.FMP_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "FMP_API_KEY absente" },
        { status: 500 }
      );
    }

    const url =
      `https://financialmodelingprep.com/stable/profile` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&apikey=${apiKey}`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `FMP a répondu avec le statut ${response.status}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur API FMP :", error);

    return NextResponse.json(
      { error: "Impossible de récupérer les données FMP" },
      { status: 502 }
    );
  }
}