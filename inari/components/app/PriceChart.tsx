"use client";

import { useEffect, useRef } from "react";
import { createChart, AreaSeries, ColorType } from "lightweight-charts";

export interface PricePoint {
  time: string;
  value: number;
}

export function generateDctPriceHistory(days = 90, peg = 100_000): PricePoint[] {
  let price = peg * 0.87;
  const now = Date.now();
  const result: PricePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const t = d.toISOString().split("T")[0];
    const noise = Math.sin(i * 2.3 + 1.7) * 0.009 + Math.sin(i * 0.7) * 0.004;
    const convergence = (peg - price) * 0.05;
    price = price + convergence + price * noise;
    result.push({ time: t, value: Math.round(price) });
  }
  return result;
}

interface PriceChartProps {
  data: PricePoint[];
  height?: number;
}

export function PriceChart({ data, height = 280 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || data.length === 0) return;

    const chart = createChart(el, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#faf2e5" },
        textColor: "rgba(26, 20, 16, 0.4)",
      },
      grid: {
        vertLines: { color: "rgba(26, 20, 16, 0.06)" },
        horzLines: { color: "rgba(26, 20, 16, 0.06)" },
      },
      crosshair: {
        vertLine: { color: "rgba(196, 74, 60, 0.5)" },
        horzLine: { color: "rgba(196, 74, 60, 0.5)" },
      },
      rightPriceScale: { borderColor: "rgba(26, 20, 16, 0.1)" },
      timeScale: { borderColor: "rgba(26, 20, 16, 0.1)", timeVisible: false },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#c44a3c",
      topColor: "rgba(196, 74, 60, 0.14)",
      bottomColor: "rgba(196, 74, 60, 0.0)",
      lineWidth: 2,
    });

    series.setData(data);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);
    chart.applyOptions({ width: el.clientWidth });

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [data, height]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
