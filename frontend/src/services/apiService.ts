// API service for SONiC dashboard
export interface RegisteredDevice {
  id: string;
  name: string;
  ip?: string;
}

export interface DeviceDetails {
  temperature_sensors: string[];
  containers: string[];
  memory_types: string[];
  os_version: string;
  kernel_version: string;
  active_interfaces: number;
}

export interface PrometheusDataPoint {
  timestamp: number;
  value: string;
}

export interface PrometheusMetric {
  metric: Record<string, string>;
  values: [number, string][];
}

export interface PrometheusResponse {
  status: string;
  data: {
    resultType: string;
    result: PrometheusMetric[];
  };
}

class ApiService {
  private readonly devicesApiUrl = 'http://localhost:8080';
  private readonly prometheusApiUrl = 'http://localhost:9090';

  // Fetch registered devices
  async getRegisteredDevices(): Promise<RegisteredDevice[]> {
    try {
	  const res = await fetch('http://localhost:8080/registered_devices', { headers: { Accept: 'application/json' } });
	  if (!res.ok) throw new Error(`HTTP ${res.status}`);
	  const data = await res.json(); // single read
      return data.registered_devices || [];
    } catch (error) {
      // Return mock data as fallback
      return [
        { id: 'ixr-7220-h5-32d-evt2-1', name: 'SONiC Switch 01', ip: '192.168.1.10' },
        { id: 'sonic-sw-02', name: 'SONiC Switch 02', ip: '192.168.1.11' },
      ];
    }
  }

  // Fetch device details
  async getDeviceDetails(deviceName: string): Promise<DeviceDetails | null> {
    try {
      const response = await fetch(`${this.devicesApiUrl}/details/${deviceName}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch device details: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  // Fetch data from Prometheus
  async fetchPrometheusData(
    parameter: string,
    deviceName: string,
    secondParameter?: string,
    secondValue?: string
  ): Promise<PrometheusResponse | null> {
    try {
      const end = Math.floor(Date.now() / 1000); // Current time in epoch
      const start = end - 3600; // 1 hour ago (end - 3600)

      let query = `${parameter}{job="${deviceName}"`;
      if (secondParameter && secondValue) {
        query += `, ${secondParameter}="${secondValue}"`;
      }
      query += '}';

      const url = `${this.prometheusApiUrl}/api/v1/query_range?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=30s`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Prometheus API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  // Transform Prometheus data to chart format
  transformPrometheusDataToChart(prometheusResponse: PrometheusResponse | null): Array<{time: string, [key: string]: any}> {
    if (!prometheusResponse || !prometheusResponse.data.result.length) {
      return [];
    }

    const dataPoints = new Map<number, any>();

    prometheusResponse.data.result.forEach((metric) => {
      const metricName = metric.metric.sensor || metric.metric.memory_type || metric.metric.docker || metric.metric.cpu || 'value';
      
      metric.values.forEach(([timestamp, value]) => {
        if (!dataPoints.has(timestamp)) {
          dataPoints.set(timestamp, {
            time: new Date(timestamp * 1000).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })
          });
        }
        dataPoints.get(timestamp)[metricName] = parseFloat(value);
      });
    });

    return Array.from(dataPoints.values()).sort((a, b) => 
      new Date(`1970-01-01 ${a.time}`).getTime() - new Date(`1970-01-01 ${b.time}`).getTime()
    );
  }

  // Transform Prometheus data for multiple series (like temperature with multiple sensors)
  transformMultiSeriesData(prometheusResponse: PrometheusResponse | null): Array<{time: string, [key: string]: any}> {
    return this.transformPrometheusDataToChart(prometheusResponse);
  }
}

export const apiService = new ApiService();
