#!/bin/bash

# This is a script to get the memory usage in bytes
echo "# TYPE memory_usage gauge"
echo "# UNIT memory_usage bytes"
echo "# HELP memory_usage Memory usage of system"

IFS=$'\n'

# getting total memory
MEMORY_TYPE=$(free -b | awk 'NR==1{print $1}')
TOTAL=$(free -b | awk 'NR==2{print $2}')
if [[ -n "$TOTAL" ]]; then
	echo "memory_usage{memory_type=\"$MEMORY_TYPE\"} $TOTAL"
fi

# getting used memory
MEMORY_TYPE=$(free -b | awk 'NR==1{print $2}')
USED=$(free -b | awk 'NR==2{print $3}')
if [[ -n "$USED" ]]; then
	echo "memory_usage{memory_type=\"$MEMORY_TYPE\"} $USED"
fi

# getting free memory
MEMORY_TYPE=$(free -b | awk 'NR==1{print $3}')
FREE=$(free -b | awk 'NR==2{print $4}')
if [[ -n "$FREE" ]]; then
	echo "memory_usage{memory_type=\"$MEMORY_TYPE\"} $FREE"
fi

# getting shared memory
MEMORY_TYPE=$(free -b | awk 'NR==1{print $4}')
SHARED=$(free -b | awk 'NR==2{print $5}')
if [[ -n "$SHARED" ]]; then
	echo "memory_usage{memory_type=\"$MEMORY_TYPE\"} $SHARED"
fi

# getting cache memory
CACHE=$(free -b | awk 'NR==2{print $6}')
if [[ -n "$CACHE" ]]; then
	echo "memory_usage{memory_type=\"cache\"} $CACHE"
fi

# getting available memory
MEMORY_TYPE=$(free -b | awk 'NR==1{print $6}')
AVAILABLE=$(free -b | awk 'NR==2{print $7}')
if [[ -n "$AVAILABLE" ]]; then
	echo "memory_usage{memory_type=\"$MEMORY_TYPE\"} $AVAILABLE"
fi

# getting total swap memory
SWAP_TYPE=$(free -b | awk 'NR==1{print $1}')
TOTAL_SWAP=$(free -b | awk 'NR==3{print $2}')
if [[ -n "$TOTAL_SWAP" ]]; then
	echo "memory_usage{swap_type=\"$SWAP_TYPE\"} $TOTAL_SWAP"
fi

# getting used swap memory
SWAP_TYPE=$(free -b | awk 'NR==1{print $2}')
USED_SWAP=$(free -b | awk 'NR==3{print $3}')
if [[ -n "$USED_SWAP" ]]; then
	echo "memory_usage{swap_type=\"$SWAP_TYPE\"} $USED_SWAP"
fi

# getting free swap memory
SWAP_TYPE=$(free -b | awk 'NR==1{print $3}')
FREE_SWAP=$(free -b | awk 'NR==3{print $4}')
if [[ -n "$FREE_SWAP" ]]; then
	echo "memory_usage{swap_type=\"$SWAP_TYPE\"} $FREE_SWAP"
fi