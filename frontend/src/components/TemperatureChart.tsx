import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { apiService, DeviceDetails } from '../services/apiService';

interface TemperatureChartProps {
  deviceName: string;
  deviceDetails: DeviceDetails | null;
}

const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'];

export function TemperatureChart({ deviceName, deviceDetails }: TemperatureChartProps) {
  const [temperatureData, setTemperatureData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemperatureData = async () => {
      if (!deviceDetails || !deviceDetails.temperature_sensors.length) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch data for all temperature sensors
        const dataPromises = deviceDetails.temperature_sensors.map(sensor =>
          apiService.fetchPrometheusData('temperature_celsius', deviceName, 'sensor', sensor)
        );

        const responses = await Promise.all(dataPromises);
        
        // Combine all sensor data into a single dataset
        const combinedData = new Map<string, any>();

        responses.forEach((response, index) => {
          if (response && response.data.result.length > 0) {
            const sensorName = deviceDetails.temperature_sensors[index];
            response.data.result.forEach(metric => {
              metric.values.forEach(([timestamp, value]) => {
                const timeKey = new Date(timestamp * 1000).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                if (!combinedData.has(timeKey)) {
                  combinedData.set(timeKey, { time: timeKey });
                }
                
                combinedData.get(timeKey)[sensorName] = parseFloat(value);
              });
            });
          }
        });

        const chartData = Array.from(combinedData.values()).sort((a, b) => 
          new Date(`1970-01-01 ${a.time}`).getTime() - new Date(`1970-01-01 ${b.time}`).getTime()
        );

        setTemperatureData(chartData);
      } catch (err) {
        console.error('Error fetching temperature data:', err);
        setError('Failed to load temperature data');
      } finally {
        setLoading(false);
      }
    };

    fetchTemperatureData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchTemperatureData, 30000);
    return () => clearInterval(interval);
  }, [deviceName, deviceDetails]);
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Device Temperature Monitoring</CardTitle>
          <CardDescription>Loading temperature data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !deviceDetails || deviceDetails.temperature_sensors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Device Temperature Monitoring</CardTitle>
          <CardDescription>
            {error || 'No temperature sensors found for this device'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">
              {error || 'No temperature sensors available'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Device Temperature Monitoring</CardTitle>
        <CardDescription>
          Real-time temperature readings from {deviceName} (°C) • 
          Sensors: {deviceDetails.temperature_sensors.join(', ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={temperatureData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis domain={[30, 80]} />
            <Tooltip />
            <Legend />
            {deviceDetails.temperature_sensors.map((sensor, index) => (
              <Line 
                key={sensor}
                type="monotone" 
                dataKey={sensor} 
                stroke={colors[index % colors.length]} 
                strokeWidth={2} 
                name={`Sensor ${sensor}`}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
