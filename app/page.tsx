"use client";
import localFont from "next/font/local";
import Link from "next/link";
import { isParisMarketOpen } from "@/lib/marketHours";
import { stocks } from "@/lib/stocks";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import StockPriceChart from "@/components/StockPriceChart";
import InvestmentCriteria from "@/components/InvestmentCriteria";
const unifraktur = localFont({
  src: "./fonts/UnifrakturMaguntia-Book.ttf",
  display: "swap",
});
type CompanySearchResult = {
  symbol: string;
  name: string;
  shortName: string | null;
  longName: string | null;
  exchange: string | null;
  quoteType: string | null;
};
type CompanySearchResponse = {
  success: boolean;
  query?: string;
  results?: CompanySearchResult[];
  error?: string;
};
type CompanyFinancialsResponse = {
  success: boolean;
  symbol?: string;
  period?: { startYear: number; endYear: number; years: number[] };
  criteria?: {
    revenueGrowthCagr: number | null;
    netDebtToFCF: number | null;
    freeCashFlowGrowthCagr: number | null;
    dilutedSharesChange: number | null;
    superRoic: number | null;
    averageFcfMargin: number | null;
  };
  error?: string;
};
type CriterionCard = { title: string; subtitle: string; value: number | null; suffix: string; passed: boolean | null };
export default function Home() {
  const [liveStocks, setLiveStocks] =
    useState(stocks);
  const [
    companySearchOpen,
    setCompanySearchOpen,
  ] = useState(false);
  const [
    companySearch,
    setCompanySearch,
  ] = useState("");
  const [
    companySearchResults,
    setCompanySearchResults,
  ] = useState<CompanySearchResult[]>([]);
  const [
    companySearchLoading,
    setCompanySearchLoading,
  ] = useState(false);
  const [
    companySearchError,
    setCompanySearchError,
  ] = useState<string | null>(null);
  const [
    selectedCompany,
    setSelectedCompany,
  ] = useState<CompanySearchResult | null>(
    null
  );
  const [companyFinancials, setCompanyFinancials] = useState<CompanyFinancialsResponse | null>(null);
  const [companyFinancialsLoading, setCompanyFinancialsLoading] = useState(false);
  const [companyFinancialsError, setCompanyFinancialsError] = useState<string | null>(null);
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
  async function searchCompany(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const query =
      companySearch.trim();
    if (!query) {
      return;
    }
    setCompanySearchLoading(true);
    setCompanySearchError(null);
    setCompanySearchResults([]);
    setSelectedCompany(null);
    try {
      const response =
        await fetch(
          `/api/company-search?q=${encodeURIComponent(
            query
          )}`
        );
      const data =
        (await response.json()) as CompanySearchResponse;
      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ??
            "Impossible d'effectuer la recherche."
        );
      }
      const results =
        Array.isArray(data.results)
          ? data.results
          : [];
      setCompanySearchResults(
        results
      );
      if (results.length === 0) {
        setCompanySearchError(
          "Aucune entreprise trouvée."
        );
      }
    } catch (error) {
      console.error(
        "Erreur recherche entreprise :",
        error
      );
      setCompanySearchError(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue."
      );
    } finally {
      setCompanySearchLoading(false);
    }
  }
  async function selectCompany(company: CompanySearchResult) {
    setSelectedCompany(company);
    setCompanySearchResults([]);
    setCompanySearchError(null);
    setCompanySearch(company.name);
    setCompanyFinancials(null);
    setCompanyFinancialsError(null);
    setCompanyFinancialsLoading(true);
    try {
      const response = await fetch(`/api/company-financials?symbol=${encodeURIComponent(company.symbol)}`);
      const data = (await response.json()) as CompanyFinancialsResponse;
      if (!response.ok || !data.success) throw new Error(data.error ?? "Impossible de calculer les critères de cette entreprise.");
      setCompanyFinancials(data);
    } catch (error) {
      console.error("Erreur analyse entreprise :", error);
      setCompanyFinancialsError(error instanceof Error ? error.message : "Une erreur est survenue pendant l'analyse.");
    } finally {
      setCompanyFinancialsLoading(false);
    }
  }
  function toggleCompanySearch() {
    setCompanySearchOpen(
      (current) => !current
    );
    setCompanySearchResults([]);
    setCompanySearchError(null);
    setSelectedCompany(null);
    setCompanyFinancials(null);
    setCompanyFinancialsError(null);
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
                  <div className="flex items-start">
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
                        className="relative inline-block text-sm text-slate-600 transition-colors duration-200 hover:text-[#6b1f1f] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[#6b1f1f] after:transition-all after:duration-300 hover:after:w-full"
                      >
                        Graphique
                      </Link>
                      <a
                        href={
                          stock.name === "LVMH"
                            ? "https://stockanalysis.com/quote/epa/MC/financials/income-statement/"
                            : "https://stockanalysis.com/quote/epa/RMS/financials/income-statement/"
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative inline-block text-sm text-slate-600 transition-colors duration-200 hover:text-[#6b1f1f] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[#6b1f1f] after:transition-all after:duration-300 hover:after:w-full"
                      >
                        Income Statement
                      </a>
                    </div>
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
                            stock.price !== null && stock.price <= alert;
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
        {/* RECHERCHE ENTREPRISE */}
        {/* ========================= */}
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={
              toggleCompanySearch
            }
            className="relative inline-block text-sm text-slate-600 transition-colors duration-200 hover:text-[#6b1f1f] after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-0 after:bg-[#6b1f1f] after:transition-all after:duration-300 hover:after:w-full"
          >
            Rechercher une entreprise
          </button>
          {companySearchOpen && (
            <div className="mx-auto mt-5 max-w-xl text-left">
              <form
                onSubmit={
                  searchCompany
                }
                className="flex gap-3"
              >
                <input
                  type="text"
                  value={
                    companySearch
                  }
                  onChange={(
                    event
                  ) => {
                    setCompanySearch(
                      event.target.value
                    );
                    setSelectedCompany(
                      null
                    );
                    setCompanySearchResults(
                      []
                    );
                    setCompanySearchError(
                      null
                    );
                  }}
                  placeholder="Nom de l'entreprise ou symbole boursier"
                  autoFocus
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500"
                />
                <button
                  type="submit"
                  disabled={
                    companySearch.trim()
                      .length === 0 ||
                    companySearchLoading
                  }
                  className="rounded-xl bg-slate-900 px-5 py-3 text-base font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {companySearchLoading
                    ? "Recherche..."
                    : "Rechercher"}
                </button>
              </form>
              {companySearchError && (
                <p className="mt-4 text-center text-sm text-red-700">
                  {companySearchError}
                </p>
              )}
              {companySearchResults.length >
                0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {companySearchResults.map(
                    (company) => (
                      <button
                        key={`${company.symbol}-${company.exchange ?? ""}`}
                        type="button"
                        onClick={() =>
                          selectCompany(
                            company
                          )
                        }
                        className="flex w-full items-center justify-between gap-5 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            {company.name}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {company.exchange ??
                              "Bourse non précisée"}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-slate-700">
                          {company.symbol}
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}
              {selectedCompany && (
                <div className="mt-5 border-t border-slate-200 pt-5">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-slate-900">{selectedCompany.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedCompany.symbol}{selectedCompany.exchange ? ` — ${selectedCompany.exchange}` : ""}
                    </p>
                  </div>
                  {companyFinancialsLoading && <p className="mt-6 text-center text-sm text-slate-500">Calcul des 6 critères...</p>}
                  {companyFinancialsError && <p className="mt-6 text-center text-sm text-red-700">{companyFinancialsError}</p>}
                  {companyFinancials?.criteria && (
                    <div className="mt-7">
                      {companyFinancials.period && (
                        <p className="mb-4 text-center text-xs text-slate-500">
                          Analyse des exercices {companyFinancials.period.startYear} → {companyFinancials.period.endYear}
                        </p>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          { title: "Croissance du chiffre d'affaires", subtitle: "par an sur les 5 dernières années, doit être supérieur à 10%", value: companyFinancials.criteria.revenueGrowthCagr, suffix: "%", passed: companyFinancials.criteria.revenueGrowthCagr == null ? null : companyFinancials.criteria.revenueGrowthCagr > 10 },
                          { title: "Dette nette / Free cash flow", subtitle: "au dernier trimestre, doit être inférieur à 3", value: companyFinancials.criteria.netDebtToFCF, suffix: "", passed: companyFinancials.criteria.netDebtToFCF == null ? null : companyFinancials.criteria.netDebtToFCF < 3 },
                          { title: "Croissance du Free cash flow", subtitle: "par an sur les 5 dernières années, doit être supérieur à 10%", value: companyFinancials.criteria.freeCashFlowGrowthCagr, suffix: "%", passed: companyFinancials.criteria.freeCashFlowGrowthCagr == null ? null : companyFinancials.criteria.freeCashFlowGrowthCagr > 10 },
                          { title: "Nombre d'actions en circulation", subtitle: "sur les 5 dernières années, doit être inférieur ou égal à 0%", value: companyFinancials.criteria.dilutedSharesChange, suffix: "%", passed: companyFinancials.criteria.dilutedSharesChange == null ? null : companyFinancials.criteria.dilutedSharesChange <= 0 },
                          { title: "Super ROIC", subtitle: "Super ROIC en moyenne sur 5 ans, doit être supérieur à 15%", value: companyFinancials.criteria.superRoic, suffix: "%", passed: companyFinancials.criteria.superRoic == null ? null : companyFinancials.criteria.superRoic > 15 },
                          { title: "Marge du Free cash flow", subtitle: "en moyenne sur 5 ans, doit être supérieur à 10%", value: companyFinancials.criteria.averageFcfMargin, suffix: "%", passed: companyFinancials.criteria.averageFcfMargin == null ? null : companyFinancials.criteria.averageFcfMargin > 10 },
                        ] satisfies CriterionCard[]).map((criterion) => (
                          <div
                            key={criterion.title}
                            className={`rounded-xl border p-4 text-center shadow-sm ${
                              criterion.passed === true
                                ? "border-green-200 bg-green-50"
                                : criterion.passed === false
                                  ? "border-red-200 bg-red-50"
                                  : "border-slate-200 bg-white"
                            }`}
                          >
                            <p className="text-sm font-semibold text-slate-900">{criterion.title}</p>
                            <p className="mt-1 min-h-10 text-[11px] leading-4 text-slate-500">{criterion.subtitle}</p>
                            <p className="mt-3 text-2xl font-bold text-slate-900">
                              {criterion.value == null ? "—" : `${criterion.value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${criterion.suffix}`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
