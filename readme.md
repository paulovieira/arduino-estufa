

## prepare a postgres database to save the data

create database and table

psql --command="create database arduino"
psql --command="create table readings(id serial primary key, data jsonb);" arduino

insert some dummy data and read it

psql --command="insert into readings(data) values ('{\"temperature\": 1.1}'), ('{\"temperature\": 2.2}');" arduino
psql --command="select * from reading" arduino


