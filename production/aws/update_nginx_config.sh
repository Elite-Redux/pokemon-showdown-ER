#!/bin/bash
sudo cp default-https-server-block.conf /opt/bitnami/nginx/conf/server_blocks/
sudo cp er-backend.conf /opt/bitnami/nginx/conf/elite-redux/
sudo cp er-frontend.conf /opt/bitnami/nginx/conf/elite-redux/
sudo cp nginx.conf /opt/bitnami/nginx/conf/
sudo nginx -s reload
