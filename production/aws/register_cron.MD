To edit the crontab and register cronjobs to initiate the forever scripts on startup, edit the crontab with the following command:

```bash 
	crontab -u bitnami -e
```

In the editor for the crontab, add the following lines:

``` bash 
	@reboot /usr/local/bin/forever start -c /usr/bin/node /home/bitnami/pokemon-showdown-ER/production/aws/er-backend-forever.json
	@reboot /usr/local/bin/forever start -c /usr/bin/node /home/bitnami/pokemon-showdown-ER/production/aws/er-frontend-forever.json
```