package main

import (
	"bufio"
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

type Device struct {
	Device_name string `json:"device_name"`
	Ip_address  string `json:"ip_address"`
	Username    string `json:"username"`
	Password    string `json:"password"`
}

type DeviceDetails struct {
	Temperature_sensor []string `json:"temperature_sensors"`
	Containers         []string `json:"containers"`
	Memory_types       []string `json:"memory_types"`
	Os_version         string   `json:"os_version"`
	Kernel_version     string   `json:"kernel_version"`
	Active_interfaces  string   `json:"active_interfaces"`
	Sai_version string   `json:"sai_version"`
	Asic_type			string   `json:"asic_type"`
}

type RegisteredDevices struct {
	Registered_devices []string `json:"registered_devices"`
}

type DiscoveryDevices struct {
	Discovery_devices	[]string			`json:"targets"`
	Labels				map[string]string	`json:"labels"`
}

func usage() {
	fmt.Fprintf(os.Stderr, "Usage: %s <device_list_file> <script_list_file> <server_port>\n", os.Args[0])
	os.Exit(1)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		switch origin {
		case "http://localhost:3000", "http://localhost:5173", "http://localhost:8080":
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func readCsvFile(file_path string) ([][]string, error) {
	file, err := os.Open(file_path)
	if err != nil {
		log.Printf("File %s is not able to be opened %v\n", file_path, err)
		return nil, err
	}
	defer file.Close()

	csvReader := csv.NewReader(file)
	records, err := csvReader.ReadAll()
	if err != nil || len(records) < 2 {
		log.Printf("Failed to parse the csv file %s: %v\n", file_path, err)
	}
	return records, nil
}

func main() {
	if len(os.Args) < 4 {
		usage()
	}

	device_list_file := os.Args[1]
	script_list_file := os.Args[2]
	server_port := ":" + os.Args[3]

	mux := http.NewServeMux()
	mux.HandleFunc("GET /details/{i}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("i") // path segment after /devices/
		records, _ := readCsvFile(device_list_file)
		devices := make(map[string]Device)
		for i := 1; i < len(records); i++ {
			devices[records[i][0]] = Device{
				Device_name: records[i][0],
				Ip_address:  records[i][1],
				Username:    records[i][2],
				Password:    records[i][3],
			}
		}
		device, ok := devices[id]
		if !ok {
			fmt.Printf("The requested device: %s doesn't appear to be in the device_list_file: %s\n", id, device_list_file)
			http.Error(w, "device not found", http.StatusNotFound)
			return
		}
		var device_details DeviceDetails
		cmd := `redis-cli -n 6 keys "*TEMPERATURE_INFO*" | cut -d'|' -f 2`
		ssh_config := &ssh.ClientConfig{
			User:            device.Username,
			Auth:            []ssh.AuthMethod{ssh.Password(device.Password)},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		}

		client, err := ssh.Dial("tcp", device.Ip_address+":22", ssh_config)
		if err != nil {
			fmt.Printf("Failed to dial %s: %v", device.Ip_address, err)
			http.Error(w, "ssh dial failed", http.StatusBadGateway)
			return
		}
		defer client.Close()
		getSensonrsConn, err := client.NewSession()
		if err == nil {
			var tmpStderr bytes.Buffer
			var tmpStdout bytes.Buffer
			getSensonrsConn.Stderr = &tmpStderr
			getSensonrsConn.Stdout = &tmpStdout
			if rmErr := getSensonrsConn.Run(cmd); rmErr != nil {
				fmt.Fprintf(w, "Failed to run %s:\nERROR: %s\n", cmd, tmpStderr.String())
			}
			_ = getSensonrsConn.Close()
			response := tmpStdout.String()
			lines := strings.Split(response, "\n")
			for _, line := range lines {
				device_details.Temperature_sensor = append(device_details.Temperature_sensor, line)
			}
		} else {
			fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
		}

		cmd = `docker ps -a --format "{{.Names}}"`
		getContainerConn, err := client.NewSession()
		if err == nil {
			var tmpStderr bytes.Buffer
			var tmpStdout bytes.Buffer
			getContainerConn.Stderr = &tmpStderr
			getContainerConn.Stdout = &tmpStdout
			if rmErr := getContainerConn.Run(cmd); rmErr != nil {
				fmt.Fprintf(w, "Failed to run %s:\nERROR: %s\n", cmd, tmpStderr.String())
			}
			_ = getContainerConn.Close()
			response := tmpStdout.String()
			lines := strings.Split(response, "\n")
			for _, line := range lines {
				device_details.Containers = append(device_details.Containers, line)
			}
		} else {
			fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
		}
		device_details.Memory_types = []string{"free", "used", "shared", "cache"}

		cmd = `show version | grep 'SONiC Software Version' | cut -d':' -f 2`
		getSonicVersionConn, err := client.NewSession()
		if err == nil {
			var tmpStderr bytes.Buffer
			var tmpStdout bytes.Buffer
			getSonicVersionConn.Stderr = &tmpStderr
			getSonicVersionConn.Stdout = &tmpStdout
			if rmErr := getSonicVersionConn.Run(cmd); rmErr != nil {
				fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
			}
			_ = getSonicVersionConn.Close()
			response := tmpStdout.String()
			lines := strings.Split(response, "\n")
			device_details.Os_version = lines[0]
		} else {
			fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
		}

		cmd = `show version | grep 'ASIC:' | cut -d':' -f 2`
		getAsicTypeConn, err := client.NewSession()
		if err == nil {
			var tmpStderr bytes.Buffer
			var tmpStdout bytes.Buffer
			getAsicTypeConn.Stderr = &tmpStderr
			getAsicTypeConn.Stdout = &tmpStdout
			if rmErr := getAsicTypeConn.Run(cmd); rmErr != nil {
				fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
			}
			_ = getAsicTypeConn.Close()
			response := tmpStdout.String()
			lines := strings.Split(response, "\n")
			device_details.Asic_type = lines[0]
		} else {
			fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
		}

		cmd = `show version | grep 'Kernel' | cut -d':' -f 2`
		getKernelVersionConn, err := client.NewSession()
		if err == nil {
			var tmpStderr bytes.Buffer
			var tmpStdout bytes.Buffer
			getKernelVersionConn.Stderr = &tmpStderr
			getKernelVersionConn.Stdout = &tmpStdout
			if rmErr := getKernelVersionConn.Run(cmd); rmErr != nil {
				fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
			}
			_ = getKernelVersionConn.Close()
			response := tmpStdout.String()
			lines := strings.Split(response, "\n")
			device_details.Kernel_version = lines[0]
		} else {
			fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
		}

		cmd = `docker exec syncd bash -c "dpkg -l | grep sai" | head -1 | awk '{print $2" "$3}'`
		getSaiVersionConn, err := client.NewSession()
		if err == nil {
			var tmpStderr bytes.Buffer
			var tmpStdout bytes.Buffer
			getSaiVersionConn.Stderr = &tmpStderr
			getSaiVersionConn.Stdout = &tmpStdout
			if rmErr := getSaiVersionConn.Run(cmd); rmErr != nil {
				fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
			}
			_ = getSaiVersionConn.Close()
			response := tmpStdout.String()
			lines := strings.Split(response, "\n")
			device_details.Sai_version = lines[0]
		} else {
			fmt.Fprintf(w, "Failed to create session to run %s: %v\n", cmd, err)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(device_details)
	})

	mux.HandleFunc("GET /registered_devices", func(w http.ResponseWriter, r *http.Request) {
		records, _ := readCsvFile(device_list_file)
		var registered_devices RegisteredDevices
		for i := 1; i < len(records); i++ {
			registered_devices.Registered_devices = append(registered_devices.Registered_devices, records[i][0])
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(registered_devices)

	})
	mux.HandleFunc("GET /discovery", func(w http.ResponseWriter, r *http.Request) {
		records, _ := readCsvFile(device_list_file)
		prometheus_devices := make([]DiscoveryDevices, len(records) -1)
		for i := 1; i < len(records); i++ {
			discover_device := "localhost" + server_port 
			prometheus_devices[i-1].Discovery_devices = append(prometheus_devices[i-1].Discovery_devices, discover_device)
			prometheus_devices[i-1].Labels = make(map[string]string)
			prometheus_devices[i-1].Labels["path"] = "/devices/" + records[i][0]
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(prometheus_devices)

	})
	mux.HandleFunc("GET /devices/{i}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("i") // path segment after /devices/

		records, _ := readCsvFile(device_list_file)
		devices := make(map[string]Device)
		for i := 1; i < len(records); i++ {
			devices[records[i][0]] = Device{
				Device_name: records[i][0],
				Ip_address:  records[i][1],
				Username:    records[i][2],
				Password:    records[i][3],
			}
		}

		device, ok := devices[id]
		if !ok {
			fmt.Printf("The requested device: %s doesn't appear to be in the device_list_file: %s\n", id, device_list_file)
			http.Error(w, "device not found", http.StatusNotFound)
			return
		}

		f, err := os.Open(script_list_file)
		if err != nil {
			fmt.Printf("Failed to open script_list_file: %s\nERROR: %v\n", script_list_file, err)
			http.Error(w, "failed to open scripts list", http.StatusInternalServerError)
			return
		}
		defer f.Close()

		var script_files []string
		sc := bufio.NewScanner(f)
		for sc.Scan() {
			script_files = append(script_files, sc.Text())
		}
		if err = sc.Err(); err != nil {
			fmt.Printf("Failed to parse scripts from script_list_file: %s\nERROR: %v\n", script_list_file, err)
			http.Error(w, "failed to parse scripts list", http.StatusInternalServerError)
			return
		}
		ssh_config := &ssh.ClientConfig{
			User:            device.Username,
			Auth:            []ssh.AuthMethod{ssh.Password(device.Password)},
			HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		}

		client, err := ssh.Dial("tcp", device.Ip_address+":22", ssh_config)
		if err != nil {
			fmt.Printf("Failed to dial %s: %v", device.Ip_address, err)
			http.Error(w, "ssh dial failed", http.StatusBadGateway)
			return
		}
		defer client.Close()

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

		var wait_group sync.WaitGroup
		for _, script_file := range script_files {
			file_base := filepath.Base(script_file)
			remotePath := "/tmp/" + file_base
			wait_group.Add(1)
			go func() {
				defer wait_group.Done()
				// Create SFTP client once, reuse for all uploads
				sftpClient, err := sftp.NewClient(client)
				if err != nil {
					fmt.Printf("Failed to start SFTP subsystem: %v\n", err)
					http.Error(w, "sftp init failed", http.StatusBadGateway)
					return
				}
				defer sftpClient.Close()
				// Open local script for reading
				src, err := os.Open(script_file)
				if err != nil {
					fmt.Printf("Failed to open local script file: %s\nERROR: %v\n", script_file, err)
					return
				}

				// Create remote file and copy content via SFTP
				dst, err := sftpClient.Create(remotePath)
				if err != nil {
					src.Close()
					fmt.Fprintf(w, "Failed to create remote script file: %s on host %s\nERROR: %v\n", remotePath, device.Device_name, err)
					return
				}

				_, copyErr := dst.ReadFrom(src)
				closeErr1 := dst.Close()
				closeErr2 := src.Close()
				if copyErr != nil {
					fmt.Fprintf(w, "Failed to upload script file to host %s\nERROR: %v\n", device.Device_name, copyErr)
					_ = closeErr1
					_ = closeErr2
					return
				}
				if closeErr1 != nil || closeErr2 != nil {
					// Non-fatal; report if needed
				}

				// Run the uploaded script with sudo bash
				session, err := client.NewSession()
				if err != nil {
					fmt.Printf("Failed to create session: %v", err)
					fmt.Fprintf(w, "Failed to create SSH session: %v\n", err)
					return
				}

				var stdout, stderr bytes.Buffer
				session.Stdout = &stdout
				session.Stderr = &stderr

				cmd := fmt.Sprintf(`sudo bash %s`, remotePath)
				if err = session.Run(cmd); err != nil {
					fmt.Fprintf(w, "Failed to run script_file %s:\nERROR: %s\n", remotePath, stderr.String())
					_ = session.Close()
					rmSess, rmErr := client.NewSession()
					if rmErr == nil {
						_ = rmSess.Run(fmt.Sprintf(`sudo rm -f %s`, remotePath))
						_ = rmSess.Close()
					}
					return
				}
				_ = session.Close()

				rmSess, err := client.NewSession()
				if err == nil {
					var rmStderr bytes.Buffer
					rmSess.Stderr = &rmStderr
					if rmErr := rmSess.Run(fmt.Sprintf(`sudo rm -f %s`, remotePath)); rmErr != nil {
						fmt.Fprintf(w, "Failed to remove %s:\nERROR: %s\n", remotePath, rmStderr.String())
					}
					_ = rmSess.Close()
				} else {
					fmt.Fprintf(w, "Failed to create session to remove %s: %v\n", remotePath, err)
				}

				// Write command stdout to HTTP response
				if _, err := w.Write(stdout.Bytes()); err != nil {
					fmt.Printf("Failed to send answer to requester\n")
					return
				}
				_, _ = w.Write([]byte("\n"))
			}()
		}
		wait_group.Wait()
		_, _ = w.Write([]byte("\n#EOF\n"))
	})

	log.Fatal(http.ListenAndServe(server_port, withCORS(mux)))
}
