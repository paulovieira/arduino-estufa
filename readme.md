## arduino-estufa

Objective: read data from an arduino, save to postgres and send to a google sheet (in use at FCUL).

### introduction

The processing is done with 2 separate scripts:

1) `arduino_read.js` - will connect to the arduino (using the `serialport` module), fetch the data and save to a local postgres database (in the "t_raw" table). The arduino is sending data once every minute

2) `average` - will be executed every 30min; will read the data from the last 30min, exclude outliers, compute the average (for each sensor) and save in the "t_avg" table

3) `upload.js` - will be executed every hour; send the data in "t_avg" to a google sheet; 

### prepare a postgres database to save the data

1) create database and table
```bash
psql --command="create database arduino"

psql --command="create table t_raw( \
                    id serial primary key, \
                    sensor_id text, \
                    temperature text, \
                    humidity text, \
                    ts timestamptz not null default now());"  arduino

psql --command="create table t_avg( \
                    id serial primary key, \
                    data jsonb, \
                    sent_to_cloud bool default false);"  arduino

psql --command="create table t_log( \
                    id serial primary key, \
                    data jsonb, \
                    sent_to_cloud bool default false);"  arduino
```

2) insert some dummy data and verify
```bash
psql --command="insert into t_raw(sensor_id, temperature, humidity) \
        values ('sht1x', '21', '60'), \
            ('sht1x2', '22', '61'), \
            ('sht1x', '24', '64'), \
            ('sht1x2', '26', '67');"  arduino

psql --command="select * from t_raw" arduino
```


psql --command="insert into t_raw(sensor_id, temperature, humidity) \
        values ('sht1x', '31', '70'), \
            ('sht1x2', '32', '71'), \
            ('sht1x', '34', '74'), \
            ('sht1x2', '36', '77');"  arduino


select sensor_id, 
    avg(temperature::real) temp_avg, 
    avg(humidity::real) hum_avg,
    now() as ts
from t_raw 
where ts > now() - '60 minute'::interval
    and temperature::real between -5 and 50
    and humidity::real between -5 and 105
group by sensor_id;





### set up crontab

`arduinoi_read.js` will be called every ... min.

`upload.js` will be called every ... min.

Open the crontab editor (should be executed as a superuser because we need to open a connection to a serial port):
```bash
sudo crontab -e
```

Add at the end:
```bash
*/5 * * * * cd /home/pvieira/github/arduino-estufa && bash ./read_and_save.sh
*/30 * * * * cd /home/pvieira/github/arduino-estufa && node ./upload.js
00 05 * * * /sbin/shutdown -r now

#network manager seems to fail with eduroam
@reboot sleep 60 && sudo /sbin/dhclient -r
*/30 * * * * sudo /sbin/dhclient -r

```

Finally:
```bash
sudo service cron restart
```


### connect to the google api

All details here: https://www.nczonline.net/blog/2014/03/04/accessing-google-spreadsheets-from-node-js/

Note: to see the email address associated with the service account, click the "Manage service accounts" link (in the "Credentials" screen).
