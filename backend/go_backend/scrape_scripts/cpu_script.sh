#!/bin/bash

# This is a script to get the cpy usage in bytes
echo "# TYPE cpu_usage gauge"
echo "# UNIT cpu_usage bytes"
echo "# HELP cpu_usage Cpu usage of system"

IFS=$'\n'

# Get current CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print 100 - $8}')
 
echo "cpu_usage{current_cpu_usage=\"cpu_percent\"} $CPU_USAGE"
