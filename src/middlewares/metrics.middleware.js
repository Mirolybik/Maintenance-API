import client from 'prom-client';

client.collectDefaultMetrics({ prefix: 'maintenance_api_' });

export const httpRequestCounter = new client.Counter({
  name: 'maintenance_api_http_requests_total',
  help: 'Общее число HTTP-запросов',
  labelNames: ['method', 'route', 'status_code']
});

export const httpRequestDuration = new client.Histogram({
  name: 'maintenance_api_http_request_duration_seconds',
  help: 'Длительность выполнения HTTP-запросов в секундах',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]
});

export const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    httpRequestCounter.inc({ method: req.method, route, status_code: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, duration);
  });
  next();
};
