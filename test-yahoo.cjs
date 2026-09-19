const https = require("https");

function test(symbol, name) {
  return new Promise((resolve) => {
    const url =
      `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${symbol}` +
      `?symbol=${symbol}` +
      `&type=quarterlyFreeCashFlow,quarterlyOperatingCashFlow,quarterlyCapitalExpenditure` +
      `&period1=1735689600` +
      `&period2=1798761600`;

    console.log(`\n========== ${name} (${symbol}) ==========`);
    console.log("\nURL testée :");
    console.log(url);

    https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      },
      (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;
        });

        response.on("end", () => {
          console.log("\nStatut HTTP :", response.statusCode);
          console.log("\nRéponse brute :");

          try {
            console.dir(JSON.parse(body), { depth: null });
          } catch {
            console.log(body);
          }

          resolve();
        });
      }
    ).on("error", (error) => {
      console.error("ERREUR :", error);
      resolve();
    });
  });
}

async function main() {
  await test("MC.PA", "LVMH");
  await test("RMS.PA", "Hermès");
}

main();