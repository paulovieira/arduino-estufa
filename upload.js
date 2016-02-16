process.title = "estufa_upload";

var Path = require("path");
var Fs = require("fs-extra");
var Promise = require('bluebird');
var Spreadsheet = Promise.promisifyAll(require('edit-google-spreadsheet'));
var Db = require("./config/db");

var errorsPath = Path.join(__dirname, "./data/errors.log");
Fs.ensureFileSync(errorsPath);

var Config = require(Path.join(__dirname, "./config/defaults"));
var sheet, data;


var read = `
    SELECT * FROM readings WHERE remote = false ORDER BY id LIMIT 20
`;

Db.query(read)
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

            Spreadsheet.loadAsync(Config.spreadsheet)
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
        console.log(JSON.stringify(err, 0, 4));
        Fs.appendFile(errorsPath, JSON.stringify(err, 0, 4) + "\n\n");
    });

