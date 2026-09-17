import { NextResponse } from "next/server";
import AdmZip from "adm-zip";

export async function GET() {
  try {
    const response = await fetch(
      "https://marketdata.euronext.com/data-reporting-service/trades-file/download/EQUITIES/LAST_15_MINUTES/PAR"
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Euronext a répondu avec le statut ${response.status}` },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length < 4) {
      return NextResponse.json(
        { error: "Réponse Euronext vide ou invalide" },
        { status: 502 }
      );
    }

    const zip = new AdmZip(buffer);
    const entry = zip.getEntry("Trades_Equities.csv");

    if (!entry) {
      return NextResponse.json(
        { error: "CSV introuvable dans le fichier Euronext" },
        { status: 502 }
      );
    }

    const csv = entry.getData().toString("utf8");
    const lines = csv.split(/\r?\n/);

    const stocks = [
      {
        name: "LVMH",
        isin: "FR0000121014",
      },
      {
        name: "Hermès",
        isin: "FR0000052292",
      },
    ];

    const results = stocks.map((stock) => {
      const rows = lines.filter((line) =>
        line.includes(`"${stock.isin}"`)
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

      const tradingDateTime = columns[0].replace(/"/g, "");
      const price = Number(columns[3].replace(/"/g, ""));

      return {
        name: stock.name,
        isin: stock.isin,
        price,
        tradingDateTime,
      };
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Erreur API /api/stock :", error);

    return NextResponse.json(
      { error: "Impossible de récupérer les cours Euronext" },
      { status: 502 }
    );
  }
}