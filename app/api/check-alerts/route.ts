import { NextResponse } from "next/server";
import { stocks } from "@/lib/stocks";

export async function GET() {
  const res = await fetch("http://localhost:3000/api/stock", {
    cache: "no-store",
  });

  const liveStocks = await res.json();

  const alertsTriggered = stocks.flatMap((stock) => {
    const live = liveStocks.find(
      (s: { isin: string; price: number }) => s.isin === stock.isin
    );

    if (!live) return [];

    return stock.alerts
      .filter((alert) => live.price <= alert)
      .map((alert) => ({
        name: stock.name,
        isin: stock.isin,
        price: live.price,
        alert,
      }));
  });

  return NextResponse.json(alertsTriggered);
}