#!/bin/bash

# This is a script to get the docker state
echo "# TYPE docker_state gauge"
echo "# HELP docker_state Current state of docker up/down"

IFS=$'\n'

# getting state of dockers
DOCKERS=$(docker ps -a --format '{{.Names}}')
for NAME in $DOCKERS; do

    # docker state
    STATE=$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null || echo false)
    if [[ "$STATE" == true ]]; then
        echo "docker_state{docker=\"$NAME\"} 1"
    else
        echo "docker_state{docker=\"$NAME\"} 0"
    fi

    # get critical services list if file exists
    CRITICAL_SERVICES=$(docker exec "$NAME" bash -c "[ -f /etc/supervisor/critical_processes ] && cat /etc/supervisor/critical_processes")
    if [[ -z "$CRITICAL_SERVICES" ]]; then
        continue
    fi
 
    # get supervisorctl status output once
    CRITICAL_SERVICES_STATUS=$(docker exec "$NAME" supervisorctl status)
 
    # loop through each service in critical list
    for SERVICE in $CRITICAL_SERVICES; do
        # strip "program:" if present
        SERVICE_NAME=$(echo "$SERVICE" | sed 's/^program://')
 
        STATUS_LINE=$(echo "$CRITICAL_SERVICES_STATUS" | awk -v svc="$SERVICE_NAME" '$1==svc')
        STATUS=$(echo "$STATUS_LINE" | awk '{print $2}')  # RUNNING / EXITED / STOPPED etc.
 
        # normalize status to numeric (1=running,0=not)
        if [[ "$STATUS" == "RUNNING" ]]; then
            VALUE=1
        else
            VALUE=0
        fi
 
        echo "critical_services{docker=\"$NAME\",service=\"$SERVICE_NAME\"} $VALUE"
    done
done
