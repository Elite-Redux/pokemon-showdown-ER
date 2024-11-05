#!/bin/bash
cd /home/bitnami/pokemon-showdown-client-ER/
git pull

cd /home/bitnami/pokemon-showdown-ER/
git pull

cd /home/bitnami/pokemon-showdown-ER/production/aws/

forever restart er-backend
forever restart er-frontend