#!/bin/bash


#{
#	"temperature_sensors": [],
#	"containers": [],
#	"memory_types": [],
#	"os_version": "OS_VERSION_STRING",
#	"kernel_version": "KERNEL_VERSION",
#	"active_interfaces": NUMBER_OF_ACTIVE_INTERFACES,
#}



SENSORS=$(redis-cli -n 6 keys "*TEMPERATURE_INFO*")

OLD_IFS=$IFS
IFS=$'\n'

echo "{"
echo -n '"temperature_sensors": [ '
for i in $SENSORS
do
	SENSOR_NAME=$(echo $i | cut -d'|' -f 2)
	SENSOR_TEMPERATURE=$(redis-cli -n 6 hget "$i" temperature)
	if [[ -n "$SENSOR_TEMPERATURE" ]]; then
		if [[ -n "$IS_FIRST_TEMP" ]]; then
        	echo -n ", "
    	fi
		echo -n "\"$SENSOR_NAME\""
		IS_FIRST_TEMP="Y"
	fi
done
echo '],'
