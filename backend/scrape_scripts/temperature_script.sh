#!/bin/bash

#This is a script to get the device  platform temperatures
echo "# TYPE temperature_celcius gauge"
echo "# UNIT temperature_celcius celcius"
echo "# HELP temperature_celcius Current temperatures of sensors"

SENSORS=$(redis-cli -n 6 keys "*TEMPERATURE_INFO*")
TIME_STAMP=$(date +%s)
IFS=$'\n'
for i in $SENSORS
do
	SENSOR_NAME=$(echo $i | cut -d'|' -f 2)
	SENSOR_TEMPERATURE=$(redis-cli -n 6 hget "$i" temperature)
	if [[ -n "$SENSOR_TEMPERATURE" ]]; then
		echo "temperature_celcius{sensor=\"$SENSOR_NAME\"} $SENSOR_TEMPERATURE  $TIME_STAMP"
	fi
done
