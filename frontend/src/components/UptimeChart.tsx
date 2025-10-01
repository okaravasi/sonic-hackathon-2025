import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { apiService, DeviceDetails } from '../services/apiService';

interface UptimeChartProps {
  deviceName: string;
  deviceDetails: DeviceDetails | null;
}

const colors = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6'];

export function UptimeChart({ deviceName, deviceDetails }: UptimeChartProps) {
  const [containerData, setContainerData] = useState<any[]>([]);
  const [containerStatus, setContainerStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContainerData = async () => {
      if (!deviceDetails || !deviceDetails.containers.length) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch data for all containers
        const dataPromises = deviceDetails.containers.map(container =>
          apiService.fetchPrometheusData('docker_state', deviceName, 'docker', container)
        );

        const responses = await Promise.all(dataPromises);
        
        // Combine all container data into a single dataset
        const combinedData = new Map<string, any>();
        const status: Record<string, boolean> = {};

        responses.forEach((response, index) => {
          const containerName = deviceDetails.containers[index];
          
          if (response && response.data.result.length > 0) {
            status[containerName] = true; // Container is up if we have data
            
            response.data.result.forEach(metric => {
              metric.values.forEach(([timestamp, value]) => {
                const timeKey = new Date(timestamp * 1000).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                if (!combinedData.has(timeKey)) {
                  combinedData.set(timeKey, { time: timeKey });
                }
                
                // Convert to 1 (up) or 0 (down) based on memory usage
                combinedData.get(timeKey)[containerName] = parseFloat(value) > 0 ? 1 : 0;
              });
            });
          } else {
            status[containerName] = false; // Container is down if no data
          }
        });

        const chartData = Array.from(combinedData.values()).sort((a, b) => 
          new Date(`1970-01-01 ${a.time}`).getTime() - new Date(`1970-01-01 ${b.time}`).getTime()
        );

        setContainerData(chartData);
        setContainerStatus(status);
      } catch (err) {
        console.error('Error fetching container data:', err);
        setError('Failed to load container data');
      } finally {
        setLoading(false);
      }
    };

    fetchContainerData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchContainerData, 30000);
    return () => clearInterval(interval);
  }, [deviceName, deviceDetails]);

  const runningContainers = Object.values(containerStatus).filter(Boolean).length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Container Status - {deviceName}</CardTitle>
          <CardDescription>Loading container data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !deviceDetails || deviceDetails.containers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Container Status - {deviceName}</CardTitle>
          <CardDescription>
            {error || 'No containers found for this device'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">
              {error || 'No containers available'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Container Status - {deviceName}</CardTitle>
        <CardDescription>
          Running: {runningContainers}/{deviceDetails.containers.length} containers • 
          Monitoring: {deviceDetails.containers.join(', ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status indicators */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {deviceDetails.containers.map((container) => (
              <div key={container} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm">{container}</span>
                <Badge variant={containerStatus[container] ? 'default' : 'destructive'}>
                  {containerStatus[container] ? 'Up' : 'Down'}
                </Badge>
              </div>
            ))}
          </div>
          
          {/* Container status over time chart */}
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={containerData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis 
                domain={[0, 1]} 
                label={{ value: 'Status', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => value === 1 ? 'Up' : 'Down'}
              />
              <Tooltip 
                formatter={(value, name) => [value === 1 ? 'Up' : 'Down', `${name} Container`]}
              />
              <Legend />
              {deviceDetails.containers.map((container, index) => (
                <Line
                  key={container}
                  type="stepAfter"
                  dataKey={container}
                  stroke={colors[index % colors.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name={container}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
