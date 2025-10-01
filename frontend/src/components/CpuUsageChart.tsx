import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { apiService } from '../services/apiService';

interface CpuUsageChartProps {
  deviceName: string;
}

export function CpuUsageChart({ deviceName }: CpuUsageChartProps) {
  const [cpuData, setCpuData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCpuData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiService.fetchPrometheusData('cpu_usage', deviceName, 'current_cpu_usage', 'cpu_percent');
        
        if (response && response.data.result.length > 0) {
          const chartData = response.data.result[0].values.map(([timestamp, value]) => ({
            time: new Date(timestamp * 1000).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            cpu: parseFloat(value)
          }));

          setCpuData(chartData);
        } else {
          setError('No CPU data available');
        }
      } catch (err) {
        console.error('Error fetching CPU data:', err);
        setError('Failed to load CPU data');
      } finally {
        setLoading(false);
      }
    };

    fetchCpuData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchCpuData, 30000);
    return () => clearInterval(interval);
  }, [deviceName]);

  const currentUsage = cpuData.length > 0 ? cpuData[cpuData.length - 1].cpu : 0;
  const statusColor = currentUsage > 80 ? 'text-red-600' : currentUsage > 60 ? 'text-yellow-600' : 'text-green-600';

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CPU Usage - {deviceName}</CardTitle>
          <CardDescription>Loading CPU data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>CPU Usage - {deviceName}</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CPU Usage - {deviceName}</CardTitle>
        <CardDescription>
          Current: <span className={statusColor}>{currentUsage.toFixed(1)}%</span> - Average load across all cores 
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cpuData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'CPU Usage']} />
            <Line 
              type="monotone" 
              dataKey="cpu" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
