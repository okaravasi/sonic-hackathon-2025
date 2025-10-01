import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { apiService, DeviceDetails } from '../services/apiService';

interface MemoryUsageChartProps {
  deviceName: string;
  deviceDetails: DeviceDetails | null;
}

const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6'];

export function MemoryUsageChart({ deviceName, deviceDetails }: MemoryUsageChartProps) {
  const [memoryData, setMemoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMemoryData = async () => {
      if (!deviceDetails || !deviceDetails.memory_types.length) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch data for all memory types
        const dataPromises = deviceDetails.memory_types.map(memoryType =>
          apiService.fetchPrometheusData('memory_usage', deviceName, 'memory_type', memoryType)
        );

        const responses = await Promise.all(dataPromises);
        
        // Combine all memory data into a single dataset
        const combinedData = new Map<string, any>();

        responses.forEach((response, index) => {
          if (response && response.data.result.length > 0) {
            const memoryType = deviceDetails.memory_types[index];
            response.data.result.forEach(metric => {
              metric.values.forEach(([timestamp, value]) => {
                const timeKey = new Date(timestamp * 1000).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                if (!combinedData.has(timeKey)) {
                  combinedData.set(timeKey, { time: timeKey });
                }
                
                // Convert bytes to GB for better readability
                combinedData.get(timeKey)[memoryType] = parseFloat(value) / (1024 * 1024 * 1024);
              });
            });
          }
        });

        const chartData = Array.from(combinedData.values()).sort((a, b) => 
          new Date(`1970-01-01 ${a.time}`).getTime() - new Date(`1970-01-01 ${b.time}`).getTime()
        );

        setMemoryData(chartData);
      } catch (err) {
        console.error('Error fetching memory data:', err);
        setError('Failed to load memory data');
      } finally {
        setLoading(false);
      }
    };

    fetchMemoryData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchMemoryData, 30000);
    return () => clearInterval(interval);
  }, [deviceName, deviceDetails]);

  const currentUsage = memoryData[1] + memoryData[2];
  let totalUsed = 0;
  if (currentUsage && deviceDetails) {
    totalUsed = deviceDetails.memory_types.reduce((sum, type) => sum + (currentUsage[type] || 0), 0);
  }
  const usagePercent = currentUsage && totalUsed > 0 ? Math.round((totalUsed / 8) * 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Memory Usage - {deviceName}</CardTitle>
          <CardDescription>Loading memory data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !deviceDetails || deviceDetails.memory_types.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Memory Usage - {deviceName}</CardTitle>
          <CardDescription>
            {error || 'No memory types found for this device'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">
              {error || 'No memory data available'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory Usage - {deviceName}</CardTitle>
        <CardDescription>
          Types: {deviceDetails.memory_types.join(', ')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={memoryData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis domain={[0, 'dataMax']} label={{ value: 'GB', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              formatter={(value, name) => [`${Number(value).toFixed(2)}GB`, `${name} Memory`]}
            />
            {deviceDetails.memory_types.map((memoryType, index) => (
              <Area
                key={memoryType}
                type="monotone"
                dataKey={memoryType}
                stackId="1"
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.8}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
