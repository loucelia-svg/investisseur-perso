import { NextResponse } from "next/server";

const EULERPOOL_BASE_URL = "https://api.eulerpool.com";

export async function GET() {
  const apiKey = process.env.EULERPOOL_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: "EULERPOOL_API_KEY manquante",
      },
      { status: 500 }
    );
  }

  const ticker = "MC.PA";
  const endpoint = `${EULERPOOL_BASE_URL}/api/1/equity/incomestatement/${ticker}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    const text = await response.text();

    let data: unknown;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      endpoint,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue lors de l'appel Eulerpool",
        endpoint,
      },
      { status: 500 }
    );
  }
}