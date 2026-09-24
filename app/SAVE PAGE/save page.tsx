"use client";

import localFont from "next/font/local";
import Link from "next/link";
import { isParisMarketOpen } from "@/lib/marketHours";
import { stocks } from "@/lib/stocks";
import { useEffect, useState } from "react";
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
      if (!isParisMarketOpen()) {
        console.log(
          "Marché fermé : aucune requête"
        );
        return;
      }

      const response = await fetch(
        "/api/stock"
      );

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

          return liveStock?.price
            ? {
                ...stock,
                price:
                  liveStock.price,
                tradingDateTime:
                  liveStock.tradingDateTime,
              }
            : stock;
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
            stock.price <= alert
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
        {/* MES ACTIONS */}
        {/* ========================= */}

        <section>

          <div className="grid gap-5 md:grid-cols-2">

            {liveStocks.map((stock) => {

              return (
                <article
                  key={stock.name}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >

                  {/* ========================= */}
                  {/* NOM + STATUT */}
                  {/* ========================= */}

                  <div className="flex items-start justify-between">

                    <div>

                      <Link
                        href={
                          stock.name ===
                          "LVMH"
                            ? "/entreprises/lvmh"
                            : "/entreprises/hermes"
                        }
                        className="text-2xl font-bold transition-opacity hover:opacity-70"
                      >
                        {stock.name}
                      </Link>

                      <p className="mt-1 text-sm text-slate-500">
                        Euronext Paris
                      </p>

                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${stock.statusColor}`}
                    >
                      {stock.status}
                    </span>

                  </div>

                  {/* ========================= */}
                  {/* COURS ACTUEL */}
                  {/* ========================= */}

                  <div className="mt-8">

                    <div className="text-center">

                      <p
                        className="text-4xl font-bold tracking-tight text-black"
                      >
                        {stock.price.toLocaleString(
                          "fr-FR",
                          {
                            style:
                              "currency",
                            currency:
                              "EUR",
                          }
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">

                        {marketOpen
                          ? "Cours Euronext"
                          : "❌ Marché fermé — dernier cours de clôture Euronext"}

                        {stock.tradingDateTime
                          ? ` — ${new Date(
                              stock.tradingDateTime
                            ).toLocaleString(
                              "fr-FR",
                              {
                                dateStyle:
                                  "short",
                                timeStyle:
                                  "short",
                              }
                            )}`
                          : ""}

                      </p>

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

                  </div>

                  {/* ========================= */}
                  {/* ALERTES */}
                  {/* ========================= */}

                  <div className="mt-7 border-t border-slate-100 pt-5">

                    <p className="mb-3 text-sm font-semibold text-slate-700">
                      🔔 Mes alertes
                    </p>

                    <div className="flex flex-wrap gap-2">

                      {stock.alerts.map(
                        (alert) => {

                          const reached =
                            stock.price <=
                            alert;

                          return (
                            <span
                              key={alert}
                              className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                                reached
                                  ? "bg-green-100 text-green-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {reached
                                ? "🟢 Atteint"
                                : "⚪ Non atteint"}{" "}
                              — ≤{" "}
                              {alert.toLocaleString(
                                "fr-FR",
                                {
                                  style:
                                    "currency",
                                  currency:
                                    "EUR",
                                }
                              )}
                            </span>
                          );
                        }
                      )}

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

        {/* ========================= */}
        {/* PROCHAINE ÉTAPE */}
        {/* ========================= */}

        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

          <h2 className="text-xl font-semibold">
            🎯 Prochaine étape
          </h2>

          <p className="mt-2 text-slate-600">
            Les cours sont récupérés automatiquement depuis Euronext Paris.
          </p>

        </section>

      </div>
    </main>
  );
}