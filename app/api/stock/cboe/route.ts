import { NextResponse } from "next/server";

export async function GET() {
  try {
    const stocks = [
      { name: "LVMH", isin: "FR0000121014" },
      { name: "Hermès", isin: "FR0000052292" },
    ];

    const now = new Date();

    // On teste les 15 dernières minutes.
    for (let i = 0; i <= 15; i++) {
      const date = new Date(now);
      date.setUTCMinutes(date.getUTCMinutes() - i);

      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      const hour = String(
  Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(date)
  )
).padStart(2, "0");
      const minute = String(date.getUTCMinutes()).padStart(2, "0");

      const dateString = `${year}-${month}-${day}`;
      const timeString = `${hour}${minute}`;

      const fileName =
        `rts13_public_trade_data_dxe_${dateString}_${timeString}.csv`;

      const url =
        `https://markets.cboe.com/europe/equities/trade_data/dxe/minute/${fileName}`;

      try {
        const response = await fetch(url);

        if (!response.ok) {
          continue;
        }

        const text = await response.text();

        if (!text.startsWith("Timestamp,Trading Date Time")) {
          continue;
        }

        const lines = text.split(/\r?\n/);

        const results = stocks.map((stock) => {
          const rows = lines.filter((line) =>
            line.includes(`,${stock.isin},`)
          );

          if (rows.length === 0) {
            return {
              name: stock.name,
              isin: stock.isin,
              error: "Aucune transaction trouvée",
            };
          }

          const lastRow = rows[rows.length - 1];
          const columns = lastRow.split(",");

          return {
            name: stock.name,
            isin: stock.isin,
            price: Number(columns[3]),
            tradingDateTime: columns[1],
            executionVenue: columns[9]?.trim() || "",
          };
        });

        const hasStock = results.some(
          (stock) => !("error" in stock)
        );

        if (!hasStock) {
          continue;
        }

        return NextResponse.json({
          source: "Cboe",
          file: fileName,
          results,
        });
      } catch {
        continue;
      }
    }

    return NextResponse.json(
      {
        error:
          "Aucun fichier Cboe exploitable trouvé dans les 15 dernières minutes",
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("Erreur API /api/stock/cboe :", error);

    return NextResponse.json(
      { error: "Impossible de récupérer les cours Cboe" },
      { status: 502 }
    );
  }
}