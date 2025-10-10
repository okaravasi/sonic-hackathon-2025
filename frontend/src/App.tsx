import { useState, useEffect } from 'react';
import { TemperatureChart } from './components/TemperatureChart';
import { MemoryUsageChart } from './components/MemoryUsageChart';
import { CpuUsageChart } from './components/CpuUsageChart';
import { UptimeChart } from './components/UptimeChart';
import { Badge } from './components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { apiService, RegisteredDevice, DeviceDetails } from './services/apiService';

export default function App() {
  const [availableDevices, setAvailableDevices] = useState<RegisteredDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<RegisteredDevice | null>(null);
  const [deviceDetails, setDeviceDetails] = useState<DeviceDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch registered devices on component mount
  useEffect(() => {
    const fetchDevices = async () => {
      setLoading(true);
      const devices = await apiService.getRegisteredDevices();
      setAvailableDevices(devices);
      if (devices.length > 0) {
        setSelectedDevice(devices[0]);
      }
      setLoading(false);
	  console.log("We have available devices", availableDevices)
    };

    fetchDevices();
  }, []);

  // Fetch device details when selected device changes
  useEffect(() => {
    const fetchDeviceDetails = async () => {
      if (selectedDevice) {
        const details = await apiService.getDeviceDetails(selectedDevice);
		console.log(details)
        setDeviceDetails(details);
      }
    };

    if (selectedDevice) {
      fetchDeviceDetails();
    }
  }, [selectedDevice]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">SONiC Network Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Software for Open Networking in the Cloud - Real-time Monitoring
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                {loading ? 'Loading...' : availableDevices.length > 0 ? 'System Healthy' : 'No Devices'}
              </Badge>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Registered Devices</p>
                <p className="text-sm font-medium">{availableDevices.length}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Device Selector */}
      <div className="border-b bg-muted/30">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Select Device
                </label>
                <Select 
                  value={selectedDevice} 
                  onValueChange={async (value) => { 
                    const sel = availableDevices.find(d => d === value)
					setSelectedDevice(sel);
					if (sel) {
        				const details = await apiService.getDeviceDetails(sel)
						console.log(details)
        				setDeviceDetails(details)
					} else {
        				setDeviceDetails(null)
					}
                  }}
                  disabled={loading || availableDevices.length === 0}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a device..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDevices.map((device) => (
                      <SelectItem key={device} value={device}>
                        <div className="flex flex-col">
                          <span>{device}</span>
                          {device.ip && <span className="text-xs text-muted-foreground">{device.ip}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Current Device</p>
              <p className="font-medium">{selectedDevice || selectedDevice || 'None selected'}</p>
              {deviceDetails && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>OS: {deviceDetails.os_version}</p>
                  <p>ASIC type: {deviceDetails.asic_type}</p>
                  <p>SAI version: {deviceDetails.sai_version}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <main className="container mx-auto px-6 py-8">
        {selectedDevice ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TemperatureChart deviceName={selectedDevice} deviceDetails={deviceDetails} />
            <MemoryUsageChart deviceName={selectedDevice} deviceDetails={deviceDetails} />
            <CpuUsageChart deviceName={selectedDevice} />
            <UptimeChart deviceName={selectedDevice} deviceDetails={deviceDetails} />
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {loading ? 'Loading devices...' : 'No devices available. Please check your API connection.'}
            </p>
          </div>
        )}

        {/* Footer Info */}
        <footer className="mt-12 pt-8 border-t">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <h4 className="font-medium text-foreground mb-2">Data Collection</h4>
              <p>Grafana Integration: Active</p>
              <p>Collection Interval: 30s</p>
              <p>Retention Period: 30 days</p>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">SONiC Version</h4>
              {deviceDetails ? (
                <>
                  <p>OS: {deviceDetails.os_version}</p>
                  <p>Kernel: {deviceDetails.kernel_version}</p>
                  <p>Sensors: {deviceDetails.temperature_sensors.length}</p>
                  <p>Containers: {deviceDetails.containers.length}</p>
                </>
              ) : (
                <>
                  <p>Select a device to view details</p>
                  <p>API: localhost:8080</p>
                  <p>Prometheus: localhost:9090</p>
                </>
              )}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
