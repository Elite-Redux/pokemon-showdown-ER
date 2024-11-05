#!/bin/bash
forever stopall

cd /home/bitnami/pokemon-showdown-ER/
git pull
npm run build

cd /home/bitnami/pokemon-showdown-client-ER/
git pull
npm run build

cd /home/bitnami/pokemon-showdown-ER/production/aws/

bash configure_forever.sh
