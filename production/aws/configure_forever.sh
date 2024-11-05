#!/bin/bash
# This script is only suitable for an initial forever configuration.
# If the servers are already running, you shouldn't need to run this but instead should run deploy_changes.sh

forever start er-backend-forever.json
forever start er-frontend-forever.json
