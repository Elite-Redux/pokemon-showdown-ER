#!/bin/bash
forever stopall

cd /home/bitnami/pokemon-showdown-ER/
git pull

cd /home/bitnami/pokemon-showdown-client-ER/
git pull

cd /home/bitnami/pokemon-showdown-ER/
npm run build

cd /home/bitnami/pokemon-showdown-client-ER/
rm config/config.js
cp config/config-aws.js config/config-example.js
npm run build

cd /home/bitnami/pokemon-showdown-ER/production/aws/

bash configure_forever.sh
