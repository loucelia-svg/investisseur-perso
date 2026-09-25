export type Stock = {
  name: "LVMH" | "Hermès";
  isin: string;
  price: number | null;
  alerts: number[];
  tradingDateTime: string | undefined;
  tradingViewSymbol: string;
};
export const stocks: Stock[] = [
  {
    name: "LVMH",
    isin: "FR0000121014",
    price: null,
    alerts: [390, 370],
    tradingDateTime: undefined,
    tradingViewSymbol: "EURONEXT:MC",
  },
  {
    name: "Hermès",
    isin: "FR0000052292",
    price: null,
    alerts: [1250],
    tradingDateTime: undefined,
    tradingViewSymbol: "EURONEXT:RMS",
  },
];