/**
 * Minimalistické metriky v Prometheus formátu (PLAN.md 1.8, volitelné).
 * Bez externí závislosti – počítadlo requestů dle třídy stavového kódu +
 * základní procesní metriky. Endpoint /metrics je chráněný tokenem.
 */
export class Metrics {
  private total = 0;
  private byClass: Record<string, number> = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };

  record(statusCode: number): void {
    this.total += 1;
    const cls = `${Math.floor(statusCode / 100)}xx`;
    const current = this.byClass[cls];
    if (current !== undefined) this.byClass[cls] = current + 1;
  }

  render(): string {
    const mem = process.memoryUsage();
    const lines = [
      '# HELP process_uptime_seconds Doba běhu procesu.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime().toFixed(0)}`,
      '# HELP process_resident_memory_bytes RSS paměť procesu.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${mem.rss}`,
      '# HELP nodejs_heap_used_bytes Použitá heap paměť V8.',
      '# TYPE nodejs_heap_used_bytes gauge',
      `nodejs_heap_used_bytes ${mem.heapUsed}`,
      '# HELP http_requests_total Počet HTTP požadavků dle třídy stavového kódu.',
      '# TYPE http_requests_total counter',
      `http_requests_total ${this.total}`,
    ];
    for (const [cls, count] of Object.entries(this.byClass)) {
      lines.push(`http_requests_total{class="${cls}"} ${count}`);
    }
    return lines.join('\n') + '\n';
  }
}
