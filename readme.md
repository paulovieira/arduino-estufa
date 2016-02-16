## arduino-estufa

Objective: read data from an arduino, save to postgres and send to a google sheet (in use at FCUL).

### introduction

The processing is done with 2 separate scripts:

1) `read_and_save.js` - will connect to the arduino (using the `serialport` module), fetch the data and save to a local postgres database (as well as to a csv file for a quick inspection)

2) `upload.js` - will send the data to a google sheet

### prepare a postgres database to save the data

1) create database and table
```bash
psql --command="create database arduino"
psql --command="create table readings(id serial primary key, data jsonb, remote boolean default false);" arduino
psql --command="create table errors(id serial primary key, data jsonb, remote boolean default false);" arduino
```
2) insert some dummy data and and verify
```bash
psql --command="insert into readings(data) values ('{\"temperature\": 1.1}'), ('{\"temperature\": 2.2}');" arduino
psql --command="select * from readings" arduino
```

### set up crontab

`read_and_save.js` will be called every 5 min.

`upload.js` will be called every 30 min.

Open the crontab editor (should be executed as a superuser because we need to open a connection to a serial port):
```bash
sudo crontab -e
```

Add at the end:
```bash
*/5 * * * * cd /home/pvieira/github/arduino-estufa && bash ./read_and_save.sh
*/30 * * * * cd /home/pvieira/github/arduino-estufa && node ./upload.js
00 05 * * * /sbin/shutdown -r now

```

Finally:
```bash
sudo service cron restart
```


### connect to the google api

All details here: https://www.nczonline.net/blog/2014/03/04/accessing-google-spreadsheets-from-node-js/

Note: to see the email address associated with the service account, click the "Manage service accounts" link (in the "Credentials" screen).
