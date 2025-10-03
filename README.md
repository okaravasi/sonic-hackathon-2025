# Welcome to SONiC own web dashboard!

This project was developed as part of SONiC Hackathon 2505 by:

**Alexandra Goudi,  NOKIA**
**Gerasimos Pefanis, NOKIA**
**Michail-Nektarios Karatzidis, NOKIA**
**Olympia Karavasili-Arapogianni, NOKIA**

# The problem we are trying to solve

**SONiC** has **no native web UI** 
- everything is done CLI.
- Steep learning curve, slower operations, risk of errors.
- Teams often build custom scripts/tools 
	-  inconsistent & time-consuming.
- Competes poorly with commercial NOS that already ship with
dashboards.

## Our vision

- **A modern, web-based interface for managing SONiC devices.**
- **Real-time monitoring, config, and troubleshooting in one place.**
- **Reduces errors, saves time, improves accessibility.**
- **Brings SONiC in line with enterprise expectations.**

## What we have made for the demo

For the demo we have made a backend and frontend that collects 4 different metrics from SONiC devices and displays them in a graph manner on our hosted website. Below there will be instructions on how to get the project up and running.

## Future vision and extensions

- **Reporting & Alerts**
	- Ability to export reports based on a timeframe (daily, weekly, monthly, custom dates).
- **Advanced Metrics & Monitoring**
	- Include traffic counters, visual traffic display perport, Linux specific metrics.
- **Integration**
	- Usage of SONiC gNMI/Telemetry for streaming metrics to Prometheus


# How to setup and use the web dashboard

- Clone the repository
- Head to frontend and run **docker compose up --build**
	- Now the frontend should be up and running on port **3000** on **localhost**
	- You can access it via **http://localhost:3000**

- The frontend will display an error **"No devices found"**
	- This is because the backend is not yet running

- Navigate to the backend folder
- The backend is similarly dockerized but before running it:
	- Navigate to go_backend folder and modify the device_list_file with your desired devices
		- The device name can be whatever you want, but the ip, username, password must be correct

- Now navigate back to backend folder and run **docker compose up --build**
- Now your prometheus is running on port **9090** on **localhost**
- Your backend is running on port **8080** on **localhost**
- **You are all set!**
- After a while when you refresh the front end it will start showing you the devices you registered and start showing you the stats

