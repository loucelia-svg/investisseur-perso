import { getHistoricalFundamentalsForCharts } from "./fundamentals";

async function main() {
  console.log("🔎 Diagnostic Yahoo Finance");
  console.log("==========================");
  console.log("");

  try {
    const data =
      await getHistoricalFundamentalsForCharts();

    const lvmh = data.LVMH;

    for (const item of lvmh) {
      console.log(`📅 ${item.year}`);
      console.log(`   CA : ${item.revenue}`);
      console.log(`   FCF : ${item.freeCashFlow}`);
      console.log(
        `   Actions diluées : ${item.dilutedShares}`
      );
      console.log("");
    }

    console.log("==========================");
    console.log("🧪 Diagnostic terminé.");
  } catch (error) {
    console.error("❌ Erreur :", error);
    process.exitCode = 1;
  }
}

main();