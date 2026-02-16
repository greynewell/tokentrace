# tokentrace

Inference observability. Part of the [MIST stack](https://github.com/greynewell/mist-go).

[![Go](https://img.shields.io/badge/Go-1.24+-00ADD8?logo=go&logoColor=white)](https://go.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
go get github.com/greynewell/tokentrace
```

## Run

```bash
tokentrace serve --addr :8700 --max-spans 100000
```

## Ingest

```go
reporter := tokentrace.NewReporter("myapp", "http://localhost:8700")
reporter.Report(ctx, span)
```

## Query

```bash
curl localhost:8700/traces                  # list trace IDs
curl localhost:8700/traces/recent?limit=10  # recent spans
curl localhost:8700/traces/{trace-id}       # by trace
curl localhost:8700/stats                   # aggregated metrics
```

## Alerts

```go
cfg := tokentrace.Config{
    Addr:          ":8700",
    MaxSpans:      100_000,
    AlertCooldown: 5 * time.Minute,
    AlertRules: []tokentrace.AlertRule{
        {Metric: "error_rate", Op: ">", Threshold: 0.05, Level: "warning"},
        {Metric: "latency_p99", Op: ">", Threshold: 5000, Level: "critical"},
    },
}
```

## Metrics

| Metric | Type |
|--------|------|
| `total_spans` | count |
| `error_count` / `error_rate` | count / ratio |
| `latency_p50_ms` / `latency_p99_ms` | milliseconds |
| `total_tokens_in` / `total_tokens_out` | count |
| `total_cost_usd` | USD |
