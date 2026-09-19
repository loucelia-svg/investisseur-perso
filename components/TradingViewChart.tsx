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
    widgetContainer.style.height = "300px";

    currentContainer.appendChild(widgetContainer);

    const script = document.createElement("script");

    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";

    script.type = "text/javascript";
    script.async = true;

    script.innerHTML = JSON.stringify({
      height: 300,
      symbol,
      interval: "D",
      timezone: "exchange",
      theme: "light",
      style: "3",
      withdateranges: true,
      hide_top_toolbar: false,
      hide_side_toolbar: true,
      allow_symbol_change: false,
      save_image: false,
      locale: "fr",
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    currentContainer.appendChild(script);

    return () => {
      currentContainer.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div
      ref={container}
      className="tradingview-widget-container"
      style={{
        width: "100%",
        height: "300px",
      }}
    />
  );
}