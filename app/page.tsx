"use client";
import localFont from "next/font/local";
import Link from "next/link";
import { isParisMarketOpen } from "@/lib/marketHours";
import { stocks } from "@/lib/stocks";
import {
  useEffect,
  useState,
} from "react";
import StockPriceChart from "@/components/StockPriceChart";
import InvestmentCriteria from "@/components/InvestmentCriteria";
const unifraktur = localFont({
  src: "./fonts/UnifrakturMaguntia-Book.ttf",
  display: "swap",
});
export default function Home() {
  const [liveStocks, setLiveStocks] =
    useState(stocks);
  const marketOpen = isParisMarketOpen();
  function urlBase64ToUint8Array(
    base64String: string
  ) {
    const padding = "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );
    const base64 = (
      base64String + padding
    )
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData =
      window.atob(base64);
    return Uint8Array.from(
      [...rawData].map((char) =>
        char.charCodeAt(0)
      )
    );
  }
  useEffect(() => {
    const registerPush = async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window)
      ) {
        return;
      }
      const permission =
        await Notification.requestPermission();
      if (permission !== "granted") {
        return;
      }
      const registration =
        await navigator.serviceWorker.register(
          "/sw.js"
        );
      let subscription =
        await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription =
          await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(
                process.env
                  .NEXT_PUBLIC_VAPID_PUBLIC_KEY!
              ),
          });
      }
      await fetch("/api/push", {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(
          subscription
        ),
      });
    };
    const fetchStocks = async () => {
      const response = await fetch("/api/stock", { cache: "no-store" });
      const data =
        await response.json();
      if (!Array.isArray(data)) {
        console.error(
          "Réponse inattendue :",
          data
        );
        return;
      }
      setLiveStocks(
        stocks.map((stock) => {
          const liveStock =
            data.find(
              (
                item: {
                  isin: string;
                  tradingDateTime?: string;
                  price?: number;
                }
              ) =>
                item.isin === stock.isin
            );
          return typeof liveStock?.price === "number" &&
              Number.isFinite(liveStock.price)
              ? {
                  ...stock,
                  price: liveStock.price,
                  tradingDateTime: liveStock.tradingDateTime,
                }
              : {
                  ...stock,
                  price: null,
                  tradingDateTime: undefined,
                };
        })
      );
    };
    registerPush();
    fetchStocks();
    const interval = setInterval(
      fetchStocks,
      60 * 60 * 1000
    );
    return () =>
      clearInterval(interval);
  }, []);
  const alertsTriggered =
    liveStocks.flatMap((stock) =>
      stock.alerts
        .filter(
          (alert) =>
            stock.price !== null && stock.price <= alert
        )
        .map((alert) => ({
          stock: stock.name,
          alert,
        }))
    );
  return (
    <main className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* ========================= */}
        {/* EN-TÊTE */}
        {/* ========================= */}
        <header className="mb-12 border-b border-slate-300 pb-7 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
            Mon suivi boursier
          </p>
          <h1
            className={`${unifraktur.className} text-6xl font-normal leading-none tracking-normal text-slate-900`}
          >
            Investisseur Perso
          </h1>
          <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.25em] text-slate-500">
            Mes actions, mes seuils et mes opportunités.
          </p>
        </header>
        {/* ========================= */}
        {/* ANALYSE D'ENTREPRISE */}
        {/* ========================= */}
        <div className="mb-7 text-center">
          <Link
            href="/analyse"
            className={`${unifraktur.className} relative inline-block text-[17px] text-slate-600 transition-colors duration-200 hover:text-[#6b1f1f] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[#6b1f1f] after:transition-all after:duration-300 hover:after:w-full`}
          >
            Analyse d'entreprise
          </Link>
        </div>
        {/* ========================= */}
        {/* MES ACTIONS */}
        {/* ========================= */}
        <section>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {liveStocks.map((stock) => {
              return (
                <article
                  key={stock.name}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  {/* ========================= */}
                  {/* NOM + STATUT */}
                  {/* ========================= */}
                  <div className="flex items-start">
                    <div>
                      <Link
                        href={
                          stock.name ===
                          "LVMH"
                            ? "/entreprises/lvmh"
                            : "/entreprises/hermes"
                        }
                        className="font-[Georgia] text-2xl font-bold transition-opacity hover:opacity-70"
                      >
                        {stock.name}
                      </Link>
                      <p className="mt-1 text-sm text-slate-500">
                        Euronext Paris
                      </p>
                    </div>
                  </div>
                  {/* ========================= */}
                  {/* COURS ACTUEL */}
                  {/* ========================= */}
                  <div className="mt-8">
                    <div className="text-center">
                      {stock.price !== null ? (
                        <>
                          <p className="text-4xl font-bold tracking-tight text-black">
                            {stock.price.toLocaleString(
                              "fr-FR",
                              {
                                style: "currency",
                                currency: "EUR",
                              }
                            )}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {marketOpen
                              ? "🟢 Bourse ouverte — Cours Euronext"
                              : "🔴 Marché fermé — Dernier cours Euronext"}
                            {stock.tradingDateTime
                              ? ` — ${new Date(
                                  stock.tradingDateTime
                                ).toLocaleString(
                                  "fr-FR",
                                  {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  }
                                )}`
                              : ""}
                          </p>
                        </>
                      ) : (
                        <p className="text-xl font-bold text-red-700">
                          ❌ Données indisponibles
                        </p>
                      )}
                    </div>
                    {/* ========================= */}
                    {/* CRITÈRES D'INVESTISSEMENT */}
                    {/* ========================= */}
                    <InvestmentCriteria
                      company={
                        stock.name as
                          | "LVMH"
                          | "Hermès"
                      }
                    />
                    {/* ========================= */}
                    {/* GRAPHIQUE DU COURS */}
                    {/* ========================= */}
                    <StockPriceChart
                      company={
                        stock.name as
                          | "LVMH"
                          | "Hermès"
                      }
                    />
                    {/* ========================= */}
                    {/* DOCUMENTS FINANCIERS */}
                    {/* ========================= */}
                    <div className="mt-5 flex items-center justify-center gap-5">
                      <Link
                        href={`/graphes?company=${encodeURIComponent(
                          stock.name
                        )}`}
                        className={`${unifraktur.className} relative inline-block text-[17px] text-slate-600 transition-colors duration-200 hover:text-[#6b1f1f] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[#6b1f1f] after:transition-all after:duration-300 hover:after:w-full`}
                      >
                        Graphique
                      </Link>
                      <a
                        href={
                          stock.name === "LVMH"
                            ? "https\\://stockanalysis.com/quote/epa/MC/financials/income-statement/"
                            : "https\\://stockanalysis.com/quote/epa/RMS/financials/income-statement/"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${unifraktur.className} relative inline-block text-[17px] text-slate-600 transition-colors duration-200 hover:text-[#6b1f1f] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[#6b1f1f] after:transition-all after:duration-300 hover:after:w-full`}
                      >
                        Income Statement
                      </a>
                    </div>
                  </div>
                  {/* ========================= */}
                  {/* ALERTES */}
                  {/* ========================= */}
                  <div className="mt-7 border-t border-[#ded6ca]/70 pt-5">
                    <p className="mb-3 font-serif text-[17px] font-semibold tracking-[-0.01em] text-[#40372f]">
                      Alertes 🔔
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {stock.alerts.map((alert) => {
                        const reached =
                          stock.price !== null &&
                          stock.price <= alert;
                        return (
                          <div
                            key={alert}
                            className={`inline-flex items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5 shadow-[0_4px_16px_rgba(84,68,48,0.04)] ${
                              reached
                                ? "border-[#b8d3bd] bg-[#eef7ef]"
                                : "border-[#ded6ca] bg-[#fdfbf5]/90"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                reached
                                  ? "bg-[#6f9877]"
                                  : "bg-[#9a7bab]"
                              }`}
                            />
                            <span
                              className={`text-[14px] font-semibold ${
                                reached
                                  ? "text-[#315d3a]"
                                  : "text-[#40372f]"
                              }`}
                            >
                              ≤{" "}
                              {alert.toLocaleString("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                              })}
                            </span>
                            <span
                              className={`text-[11px] font-medium ${
                                reached
                                  ? "text-[#68816d]"
                                  : "text-[#9a8f83]"
                              }`}
                            >
                              {reached ? "Atteint" : "Non atteint"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        {/* ========================= */}
        {/* ALERTES DÉCLENCHÉES */}
        {/* ========================= */}
        {alertsTriggered.length >
          0 && (
          <section className="mb-10 rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-semibold text-red-800">
              🚨 Alertes déclenchées
            </h2>
            <div className="mt-3 space-y-2">
              {alertsTriggered.map(
                (item) => (
                  <p
                    key={`${item.stock}-${item.alert}`}
                    className="text-red-700"
                  >
                    🚨 {item.stock} ≤{" "}
                    {item.alert.toLocaleString(
                      "fr-FR",
                      {
                        style:
                          "currency",
                        currency:
                          "EUR",
                      }
                    )}
                  </p>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
