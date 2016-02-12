

### prepare a postgres database to save the data

1) create database and table
```bash
psql --command="create database arduino"
psql --command="create table readings(id serial primary key, data jsonb);" arduino
```
2) insert some dummy data and and verify
```bash
psql --command="insert into readings(data) values ('{\"temperature\": 1.1}'), ('{\"temperature\": 2.2}');" arduino
psql --command="select * from reading" arduino
```

