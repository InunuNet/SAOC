# --- go-live-prep F2 health probes (operator script; append to .tmp/sandbox/health/hc.sh) ---
# Never print the token. SANITY_API_TOKEN and project id come from .env.local via env_keys-style sourcing in the caller.
echo "== Sanity quota probe (one cheap GROQ ping)"
sq=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H "Authorization: Bearer $SANITY_API_TOKEN" "https://$NEXT_PUBLIC_SANITY_PROJECT_ID.api.sanity.io/v2024-01-01/data/query/production?query=%2A%5B0%5D._id")
if [ "$sq" = "402" ]; then echo "ALERT: Sanity quota exhausted (HTTP 402 plan_limit_reached)"; elif [ "$sq" = "200" ]; then echo "OK sanity query=$sq"; else echo "ALERT: Sanity probe unexpected HTTP $sq"; fi
echo "== NOS tickets hub latency probe"
tt=$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 30 https://nos.saoc.co.za/tickets)
tcode=${tt% *}; tsec=${tt#* }
if [ "$tcode" != "200" ]; then echo "ALERT: nos.saoc.co.za/tickets HTTP $tcode"; elif awk "BEGIN{exit !($tsec > 10)}"; then echo "ALERT: nos.saoc.co.za/tickets slow ${tsec}s (>10s)"; else echo "OK tickets-hub ${tsec}s"; fi
