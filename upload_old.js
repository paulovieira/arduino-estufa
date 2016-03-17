process.title = "estufa_upload";

var Path = require("path");
var Fs = require("fs-extra");
var Promise = require('bluebird');
var Spreadsheet = Promise.promisifyAll(require('edit-google-spreadsheet'));
var Db = require("./config/db");

var errorsPath = Path.join(__dirname, "./data/errors.log");
Fs.ensureFileSync(errorsPath);

var Config = require(Path.join(__dirname, "./config/defaults"));
var sheet, sheetErrors, data;


Promise.resolve()
    .then(function(){

        return Db.query(`SELECT * FROM readings WHERE remote = false ORDER BY id LIMIT 20`)        
    })
    .then(function(dataRaw){

        if(dataRaw.length>0){

            data = dataRaw
                .map(function(obj){
                    return obj.data;
                })
                .map(function(obj){

                    var keys = ["chip", "rom", "ts", "temperature", "humidity"];
                    keys.forEach(function(key){
                        obj[key] = obj[key] || "";
                    });

                    return obj;
                });

            return Spreadsheet.loadAsync(Config.spreadsheet)
                .then(function(sheetOriginal){

                    sheet = Promise.promisifyAll(sheetOriginal, {multiArgs: true});
                    return sheet.receiveAsync();
                })
                .then(function(args){

                    var rows = args[0], info = args[1];

                    // console.dir(rows);
                    // console.dir(info);

                    var newRows = [];
                    data.forEach(function(obj){
                        newRows.push([
                            obj["chip"]        || "",
                            obj["rom"]         || "",
                            obj["ts"]          || "",
                            obj["temperature"] || "",
                            obj["humidity"]    || ""
                        ]);
                    });

                    // append these lines at the end of the sheet
                    var newData = {};
                    newData[info.nextRow] = newRows;

                    sheet.add(newData);

                    return sheet.sendAsync();
                })
                .then(function(){

                    console.log("Spreadsheet has been updated");
                }).
                then(function(){

                    var ids = dataRaw.map(function(obj){
                        return obj.id;
                    });

                    var update = `
                        UPDATE readings SET remote = true WHERE id in (${ ids.join(",")})
                    `;

                    return Db.query(update);
                })
                .then(function(){

                    console.log("Database has been updated. All done!");
                })

        }
        else{
            console.log("Nothing to send.");
        }
        
    })
    .catch(function(err){

        err["ts"] = new Date().toISOString();
        console.log(JSON.stringify(err, ["message", "ts"], 4));

        Fs.appendFile(errorsPath, JSON.stringify(err, ["message", "ts"], 4) + "\n\n");
        Db.query(`INSERT INTO errors(data) VALUES('${ JSON.stringify(err, ["message", "ts"]) }');`)
    })

    // now upload errors

    .then(function(){

        return Db.query(`SELECT * FROM errors WHERE remote = false ORDER BY id LIMIT 20`);
    })
    .then(function(dataRaw){

        if(dataRaw.length>0){

            data = dataRaw
                .map(function(obj){
                    return obj.data;
                })
                .map(function(obj){

                    var keys = ["ts", "message"];
                    keys.forEach(function(key){
                        obj[key] = obj[key] || "";
                    });

                    return obj;
                });

            return Spreadsheet.loadAsync(Config.spreadsheetErrors)
                .then(function(sheetOriginal){

                    sheetErrors = Promise.promisifyAll(sheetOriginal, {multiArgs: true});
                    return sheetErrors.receiveAsync();
                })
                .then(function(args){

                    var rows = args[0], info = args[1];

                    // console.dir(rows);
                    // console.dir(info);

                    var newRows = [];
                    data.forEach(function(obj){
                        newRows.push([
                            obj["ts"]      || "",
                            obj["message"] || ""
                        ]);
                    });

                    // append these lines at the end of the sheet
                    var newData = {};
                    newData[info.nextRow] = newRows;

                    sheetErrors.add(newData);

                    return sheetErrors.sendAsync();
                })
                .then(function(){

                    console.log("Spreadsheet has been updated");
                }).
                then(function(){

                    var ids = dataRaw.map(function(obj){
                        return obj.id;
                    });

                    var update = `
                        UPDATE errors SET remote = true WHERE id in (${ ids.join(",")})
                    `;

                    return Db.query(update);
                })
                .then(function(){

                    console.log("Database has been updated. All done!");
                })
        }
        else{
            console.log("Nothing to send.");
        }
        
    })
    .catch(function(err){

        err["ts"] = new Date().toISOString();
        console.log(JSON.stringify(err, ["message", "ts"], 4));

        Fs.appendFile(errorsPath, JSON.stringify(err, ["message", "ts"], 4) + "\n\n");
        Db.query(`INSERT INTO errors(data) VALUES('${ JSON.stringify(err, ["message", "ts"]) }');`)
    });
