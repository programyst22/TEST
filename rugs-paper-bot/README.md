# Rugs Paper Arena — v0.1

Mobile-first, browser-only educational simulator. Designed to test ten simple strategy agents against a synthetic price stream.

## Safety and scope
- No connection to rugs.fun or any exchange.
- No wallet connection, private keys, deposits, withdrawals, or real orders.
- The market series is generated locally with random values; it is not live market data.
- All 100 starting units are virtual: 10 agents receive 10 each.
- Refreshing the page resets the experiment. Persistence and CSV export are not included yet.

## Run
Open `index.html` in a modern browser. On a phone, the folder can be hosted as a static site (for example GitHub Pages) or opened through a local HTML preview app.

## Files
- `index.html` — dashboard structure
- `style.css` — responsive mobile-first layout
- `app.js` — synthetic market, agent rules, virtual portfolio, journal and chart

## Next steps
1. Add deterministic seeded runs and reproducible experiments.
2. Add CSV export and local persistence.
3. Add historical-data replay from a user-provided CSV.
4. Measure each agent separately: return, win rate, max drawdown, trade count and risk-adjusted results.
5. Add configurable fees/slippage to make simulated results less optimistic.

This is a research prototype, not financial advice or a trading system.