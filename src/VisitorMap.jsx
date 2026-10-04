import { useEffect, useRef, useState } from "react";
import { CONFIG } from "./config";

// ─── Visitors around the world ───────────────────────────────────────────────
// Counts come from the Cloudflare Worker in deploy/visitor-stats-worker.js;
// the map is a Google Charts GeoChart (free, no API key) fed with ISO country
// codes, so nothing here needs a geocoding round-trip.

const LOADER_SRC = "https://www.gstatic.com/charts/loader.js";
const SESSION_KEY = "pes.visitCounted";

const regionNames =
  typeof Intl !== "undefined" && Intl.DisplayNames
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

const countryName = (code) => {
  try {
    return regionNames?.of(code) || code;
  } catch {
    return code;
  }
};

const flag = (code) =>
  String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)));

let chartsReady = null;
function loadGeoChart() {
  if (chartsReady) return chartsReady;
  chartsReady = new Promise((resolve, reject) => {
    const start = () => {
      window.google.charts.load("current", { packages: ["geochart"] });
      window.google.charts.setOnLoadCallback(() => resolve(window.google));
    };
    if (window.google?.charts) return start();
    const s = document.createElement("script");
    s.src = LOADER_SRC;
    s.async = true;
    s.onload = start;
    s.onerror = () => reject(new Error("charts blocked"));
    document.head.appendChild(s);
  });
  return chartsReady;
}

function sessionFlag() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markCounted() {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    // private mode / storage blocked — the worker dedupes server-side anyway
  }
}

function GeoChart({ countries }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let observer;

    loadGeoChart()
      .then((google) => {
        if (cancelled || !hostRef.current) return;
        const data = google.visualization.arrayToDataTable([
          ["Country", "Visitors"],
          ...countries.map((c) => [c.code, c.count]),
        ]);
        const options = {
          region: "world",
          displayMode: "regions",
          resolution: "countries",
          backgroundColor: "transparent",
          datalessRegionColor: "#161B2E",
          defaultColor: "#252D42",
          legend: "none",
          colorAxis: { colors: ["#2A3355", "#5B47D6", "#A78BFA"] },
          tooltip: { textStyle: { fontName: "monospace", fontSize: 11 } },
          chartArea: { left: 0, top: 0, width: "100%", height: "100%" },
        };
        chartRef.current = new google.visualization.GeoChart(hostRef.current);
        const draw = () => chartRef.current.draw(data, options);
        draw();
        observer = new ResizeObserver(draw);
        observer.observe(hostRef.current);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [countries]);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}

// Below this many total visits the rail shows the shaded map and a plain label
// instead of the tally. A page that advertises "11 visitors" is making the case
// against itself; counting continues regardless, so nothing is lost by waiting.
const REVEAL_AT = 250;

export default function VisitorMap({ Placeholder }) {
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const base = CONFIG.visitorStatsUrl?.replace(/\/$/, "");
    if (!base) return;
    const counted = sessionFlag();
    const controller = new AbortController();

    fetch(`${base}/${counted ? "stats" : "hit"}`, {
      method: counted ? "GET" : "POST",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then((data) => {
        if (!counted) markCounted();
        setStats(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setFailed(true);
      });

    return () => controller.abort();
  }, []);

  if (!CONFIG.visitorStatsUrl) {
    return (
      <Placeholder>
        Visitor map
        <br />
        Set visitorStatsUrl in src/config.js
      </Placeholder>
    );
  }

  if (failed) return <Placeholder>Visitor stats unavailable</Placeholder>;
  if (!stats) return <Placeholder>Loading visitors…</Placeholder>;

  const top = stats.countries.slice(0, 6);
  const revealed = stats.total >= REVEAL_AT;

  return (
    <div
      style={{
        flex: 1,
        margin: "4px 12px 12px",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 90, overflow: "hidden", borderRadius: 10 }}>
        <GeoChart countries={stats.countries} />
      </div>

      <div
        style={{
          flexShrink: 0,
          fontSize: 10,
          color: "#6B7280",
          letterSpacing: 0.5,
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid #252D42",
          paddingTop: 6,
        }}
      >
        {revealed ? (
          <>
            <span>{stats.total.toLocaleString()} VISITORS</span>
            <span>{stats.countries.length} COUNTRIES</span>
          </>
        ) : (
          <span>VISITORS BY COUNTRY</span>
        )}
      </div>

      {revealed && (
        <div style={{ flexShrink: 0, overflowY: "auto", maxHeight: 108 }}>
          {top.map((c) => (
            <div
              key={c.code}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: "#9CA3AF",
                padding: "2px 0",
              }}
            >
              <span style={{ width: 18 }}>{flag(c.code)}</span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {countryName(c.code)}
              </span>
              <span style={{ color: "#A78BFA" }}>{c.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
