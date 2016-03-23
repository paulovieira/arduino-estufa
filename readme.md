## arduino-estufa

Objective: raspberry pi reads data from an arduino, save it to a postgres db  and periodically send to a google sheet.

### introduction

The processing is done with 3 separate scripts:

1) `arduino_read.js` - will connect to the arduino (using the `serialport` module from npm), receive the data and save to a local postgres database (in the "t_raw" table). The arduino is sending data once every minute for every sensor.

2) `average.js` - will be executed every 30min by cron; for each sensor, it will select the data from the last 30min, exclude outliers, compute the average and save a new line in the "t_avg" table

3) `upload_readings.js` - will be executed right after `average.js`; it will send the data in "t_avg" that hasn't already been sent (the "sent_to_cloud" column is used to indicate that)

### prepare a postgres database to save the data

1) create database and table
```bash
psql --command="create database arduino"

psql --command="create table t_raw( \
                    chip text, \
                    rom text, \
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


### queries to obtain the averages

```sql
-- averages for the sensores with SHT1x chips
select chip, 
    avg(temperature::real) temp_avg, 
    avg(humidity::real) hum_avg
from t_raw 
where ts > now() - '30 minute'::interval
    and temperature::real between -5 and 50
    and humidity::real between -5 and 105
    and chip ilike 'sht%'
group by chip
order by chip;
```

```sql
-- averages for the sensors with DS18B20
select rom, 
    avg(temperature::real) temp_avg
from t_raw 
where ts > now() - '30 minute'::interval
    and temperature::real between -5 and 50
    and chip ilike 'ds18b20'
group by rom
order by rom;
```



### set up crontab

`arduino_read.js` is restarted every 5 min

`averages.js` and `upload_readings.js` will be called every 30 min.

Open the crontab editor (should be executed as a superuser because we need to open a connection to a serial port):
```bash
sudo crontab -e
```

Add at the end:
```bash
*/5 * * * * cd /home/pvieira/github/arduino-estufa; bash ./arduino_read_restart.sh;
*/30 * * * * cd /home/pvieira/github/arduino-estufa; node ./average.js; sleep 10; node ./dhclient.js; sleep 20; node ./upload_readings.js;

@reboot sleep 50; cd /home/pvieira/github/arduino-estufa; bash ./arduino_read_restart.sh;

# call dhclient to renew the ip; it seems we have to this because the connection to eduroam might dro periodically
# TODO: improve this
@reboot sleep 90; sudo /sbin/dhclient -r;
*/30 * * * * sudo /sbin/dhclient -r;

# restart the rpi at 5 in the morning
00 05 * * * /sbin/shutdown -r now;
```

Finally:
```bash
sudo service cron restart
```


### connect to the google api

All details here: https://www.nczonline.net/blog/2014/03/04/accessing-google-spreadsheets-from-node-js/

Note: to see the email address associated with the service account, click the "Manage service accounts" link (in the "Credentials" screen).
