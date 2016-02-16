- plug and unplug the arduino usb, make sure it works ok now
- if there is no arduino, make sure there is a record with an error (leave the arduino cable unplugged for 2 or more minutes)
- erase the csv file and the records in the database:
        psql --command="delete from readings" arduino

