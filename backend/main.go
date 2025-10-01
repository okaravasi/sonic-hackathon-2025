package main

import (
	"bufio"
	"bytes"
	"encoding/csv"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"golang.org/x/crypto/ssh"
	"github.com/pkg/sftp"
)

type Device struct {
	Device_name string `json:"device_name"`
	Ip_address  string `json:"ip_address"`
	Username    string `json:"username"`
	Password    string `json:"password"`
}

func usage() {
	fmt.Fprintf(os.Stderr, "Usage: %s <device_list_file> <script_list_file> <server_port>\n", os.Args[0])
	os.Exit(1)
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

		// Create SFTP client once, reuse for all uploads
		sftpClient, err := sftp.NewClient(client)
		if err != nil {
			fmt.Printf("Failed to start SFTP subsystem: %v\n", err)
			http.Error(w, "sftp init failed", http.StatusBadGateway)
			return
		}
		defer sftpClient.Close()

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")

	outer_loop:
		for _, script_file := range script_files {
			file_base := filepath.Base(script_file)
			remotePath := "/tmp/" + file_base

			// Open local script for reading
			src, err := os.Open(script_file)
			if err != nil {
				fmt.Fprintf(w, "Failed to open local script file: %s\nERROR: %v\n", script_file, err)
				continue
			}

			// Create remote file and copy content via SFTP
			dst, err := sftpClient.Create(remotePath)
			if err != nil {
				src.Close()
				fmt.Fprintf(w, "Failed to create remote script file: %s on host %s\nERROR: %v\n", remotePath, device.Device_name, err)
				continue
			}

			_, copyErr := dst.ReadFrom(src)
			closeErr1 := dst.Close()
			closeErr2 := src.Close()
			if copyErr != nil {
				fmt.Fprintf(w, "Failed to upload script file to host %s\nERROR: %v\n", device.Device_name, copyErr)
				_ = closeErr1
				_ = closeErr2
				continue
			}
			if closeErr1 != nil || closeErr2 != nil {
				// Non-fatal; report if needed
			}

			// Run the uploaded script with sudo bash
			session, err := client.NewSession()
			if err != nil {
				fmt.Printf("Failed to create session: %v", err)
				fmt.Fprintf(w, "Failed to create SSH session: %v\n", err)
				continue outer_loop
			}

			var stdout, stderr bytes.Buffer
			session.Stdout = &stdout
			session.Stderr = &stderr

			cmd := fmt.Sprintf(`sudo bash %s`, remotePath)
			if err = session.Run(cmd); err != nil {
				fmt.Fprintf(w, "Failed to run script_file %s:\nERROR: %s\n", remotePath, stderr.String())
				_ = session.Close()
				// Attempt to remove the remote file even if run failed
				rmSess, rmErr := client.NewSession()
				if rmErr == nil {
					_ = rmSess.Run(fmt.Sprintf(`sudo rm -f %s`, remotePath))
					_ = rmSess.Close()
				}
				continue
			}
			_ = session.Close()

			// Cleanup: remove remote script
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
				continue
			}
			_, _ = w.Write([]byte("\n"))
		}

		_, _ = w.Write([]byte("\n#EOF"))
	})

	log.Fatal(http.ListenAndServe(server_port, mux))
}

