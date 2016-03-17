process.title = "estufa_upload";

var Path = require("path");
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs-extra'));
var Spreadsheet = Promise.promisifyAll(require('edit-google-spreadsheet'));
var Db = require("./config/db");
var Fecha = require("fecha")

var logFilePath = Path.resolve("./data/log.txt");
Fs.ensureFileSync(logFilePath);

var Config = require(Path.join(__dirname, "./config/defaults"));
var sheet, sheetErrors, data;



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

                    saveToLog(err);
                });

        }
        else{
            console.log("Nothing to send.");
        }
        
    })
    .catch(function(err){

        saveToLog(err);
    });




function saveToLog(obj) {
    obj["ts"] = new Date().toISOString();
    console.log(obj);

    saveToLogFile(obj);
    saveToLogTable(obj);
}


function saveToLogFile(obj){

    var data;
    if(obj instanceof Error){
        data = JSON.stringify(obj, ["message", "ts"], 4) + "\n\n"
    }
    else{
        throw new Error("obj should be an error instance");
    }

    Fs.appendFileAsync(logFilePath, data)
        .then(function(){
            console.log("Data saved in the log file");
        })
        .catch(function(){
            console.log("Data not saved in the log file")
        });
};


function saveToLogTable(obj){

    var data;
    if(obj instanceof Error){
        data = JSON.stringify(obj, ["message", "ts"], 4) + "\n\n"
    }
    else{
        throw new Error("obj should be an error instance");
    }

    var insert = `
        INSERT INTO t_log(data) VALUES('${ data }');
    `;   

    Db.query(insert)
        .then(function(){
            console.log("Data saved in the log table");
        })
        .catch(function(err){
            console.log("Data not saved in the log table");
        });
}