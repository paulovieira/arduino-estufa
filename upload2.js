process.title = "estufa_upload";

var Path = require("path");
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs-extra'));
var Spreadsheet = Promise.promisifyAll(require('edit-google-spreadsheet'));
var Db = require("./config/db");
var Fecha = require("fecha")
var Log = require("./log");

var logFilePath = Path.resolve("./data/log.txt");
Fs.ensureFileSync(logFilePath);

var Config = require(Path.resolve("./config/defaults"));
var sheet, data;



Promise.resolve()
    .then(function(){

        return Db.query(`SELECT id,data FROM t_avg WHERE sent_to_cloud = false ORDER BY id LIMIT 20`)        
    })
    .then(function(dataRaw){

        if(dataRaw.length>0){
            //console.log(JSON.stringify(dataRaw));

            data = dataRaw
                .map(function(obj){
                    return obj.data;
                })

            return Spreadsheet.loadAsync(Config.temporarySheet)
                .then(function(sheetOriginal){

                    sheet = Promise.promisifyAll(sheetOriginal, {multiArgs: true});
                    return sheet.receiveAsync();
                })
                .then(function(args){

                    var rows = args[0], info = args[1];

                    console.log("args: ", args);
                    console.log("rows: ", rows);
                    console.log("info: ", info);

                    var newRows = [];

                    // newRows.push([10,11,12])
                    // newRows.push([30,31,32])
                    data.forEach(function(obj){

                        newRows.push([
                            Fecha.format(new Date(obj["ts"]), "YYYY-MM-DD hh:mm"),
                            obj["4d"]["temperature"] || "",
                            obj["5f"]["temperature"] || "",
                            obj["6a"]["temperature"] || "",
                            obj["sht1x"]["temperature"] || "",
                            obj["sht1x"]["humidity"] || "",
                            obj["sht1x2"]["temperature"] || "",
                            obj["sht1x2"]["humidity"] || "",
                            obj["sht1x3"]["temperature"] || "",
                            obj["sht1x3"]["humidity"] || ""

                        ]);
                    });

                    console.log("newRows", newRows)

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
                        UPDATE t_avg SET sent_to_cloud = true WHERE id in (${ ids.join(",")})
                    `;

                    return Db.query(update);
                })
                .then(function(){

                    console.log("Database has been updated. All done!");
                })
                .catch(function(err){

                    Log(err);
                });

        }
        else{
            console.log("Nothing to send.");
        }
        
    })
    .catch(function(err){

        Log(err);
    });

