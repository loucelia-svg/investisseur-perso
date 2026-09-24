export async function GET() {
  const url =
    "https://stockanalysis.com/quote/epa/RMS/revenue/";

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; InvestisseurPerso/1.0)",
      Accept: "text/html",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return new Response(
      `Erreur StockAnalysis : ${response.status}`,
      {
        status: response.status,
        headers: {
          "Content-Type":
            "text/plain; charset=utf-8",
        },
      }
    );
  }

  const html = await response.text();

  const terms = [
    "revenue:[",
    "fiscalYear:[",
    "2020",
    "2020-12-31",
    "financialData:",
    "rows:",
    "columns:",
  ];

  const results: string[] = [];

  for (const term of terms) {
    const index = html.indexOf(term);

    if (index === -1) {
      results.push(
        `===== ${term} =====\nINTROUVABLE`
      );

      continue;
    }

    results.push(
      `===== ${term} =====\n` +
        html.slice(
          Math.max(0, index - 500),
          index + 2500
        )
    );
  }

  return new Response(
    results.join("\n\n"),
    {
      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",
      },
    }
  );
}