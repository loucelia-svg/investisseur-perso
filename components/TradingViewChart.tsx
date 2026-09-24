"use client";

import { useEffect, useRef } from "react";

type TradingViewChartProps = {
  symbol: string;
};

export default function TradingViewChart({
  symbol,
}: TradingViewChartProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentContainer = container.current;

    if (!currentContainer) return;

    currentContainer.innerHTML = "";

    const widgetContainer = document.createElement("div");

    widgetContainer.className =
      "tradingview-widget-container__widget";

    widgetContainer.style.width = "100%";
    widgetContainer.style.height = "340px";

    currentContainer.appendChild(widgetContainer);

    const script = document.createElement("script");

    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "exchange",
      theme: "light",
      style: "3",

      withdateranges: false,

      hide_top_toolbar: true,
      hide_side_toolbar: true,

      allow_symbol_change: false,
      save_image: false,

      locale: "fr",

      calendar: false,

      support_host:
        "https://www.tradingview.com",
    });

    currentContainer.appendChild(script);

    return () => {
      currentContainer.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">
            Cours de l'action
          </p>

          <p className="mt-0.5 text-xs text-slate-400">
            Évolution du cours
          </p>
        </div>
      </div>

      <div
        ref={container}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
        style={{
          width: "100%",
          height: "340px",
        }}
      />
    </div>
  );
}