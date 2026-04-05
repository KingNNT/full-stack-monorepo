import { Injectable } from '@nestjs/common';
import {
  type Counter,
  type Histogram,
  metrics,
  type ObservableGauge,
} from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('api');

  counter(name: string, description?: string): Counter {
    return this.meter.createCounter(name, { description });
  }

  histogram(name: string, description?: string, unit?: string): Histogram {
    return this.meter.createHistogram(name, { description, unit });
  }

  gauge(
    name: string,
    callback: (result: { observe: (value: number) => void }) => void,
    description?: string,
  ): ObservableGauge {
    const gauge = this.meter.createObservableGauge(name, { description });
    gauge.addCallback(callback);
    return gauge;
  }
}
