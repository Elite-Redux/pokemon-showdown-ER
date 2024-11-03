#!/bin/bash
sudo cp er-backend.conf /opt/bitnami/nginx/conf/elite-redux/
sudo cp er-frontend.conf /opt/bitnami/nginx/conf/elite-redux/
sudo nginx -s reload
