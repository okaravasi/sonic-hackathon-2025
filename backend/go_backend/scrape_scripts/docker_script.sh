#!/bin/bash

# This is a script to get the docker state
echo "# TYPE docker_state gauge"
echo "# HELP docker_state Current state of docker up/down"

IFS=$'\n'

# getting state of dockers
DOCKERS=$(docker ps -a --format '{{.Names}}')
for NAME in $DOCKERS; do
    STATE=$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null || echo false)
    if [[ "$STATE" == true ]]; then
        echo "docker_state{docker=\"$NAME\"} 1"
    else
        echo "docker_state{docker=\"$NAME\"} 0"
    fi
done