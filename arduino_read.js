process.title = "arduino_read";

var Path = require("path");
var _ = require("underscore");
var Promise = require('bluebird');

var Fs = Promise.promisifyAll(require('fs-extra'));
var SP = require("serialport");
var Db = require("./config/db");

var csvPath = Path.resolve("./data/average.csv");
var configPath = Path.resolve("./config/defaults");
var logFilePath = Path.resolve("./data/log.txt");

//var Config = require(configPath);

var obj = {};
var bundle = [];
var cycleIsRunning = false;

ensureDataFiles();

SP.list(function(err, ports){

    if (err) {
        console.err("Could not list the serial ports: \n", err.message);
        saveToLog(err);
        return;
    }

	var foundArduino = false;
    for (var i = 0; i < ports.length; i++) {
        if (ports[i].pnpId !== undefined && ports[i].manufacturer.toLowerCase().indexOf("arduino") !== -1) {

			foundArduino = true;
            console.log("Found an Arduino:\n", JSON.stringify(ports[i], 0, 4));
            
            var arduinoPort = ports[i];

            // register callback to listen for the "data" event
            console.log("Opening new connection to " + arduinoPort.comName);

            var options = {
                baudrate: 9600,
                parser: SP.parsers.readline("\n")
            };

            var serialPort = new SP.SerialPort(arduinoPort.comName, options, false);
            serialPort.open(function(err) {

                if (err) {
                    saveToLog(err);
                    return;
                }

                console.log("Connection successful");
                serialPort.on("data", parseData);

/*
                setTimeout(function(){
                    serialPort.emit("data", "<data>");
                }, 2000);
                setTimeout(function(){
                    serialPort.emit("data", "chip: DS18B20");
                }, 2010);
                setTimeout(function(){
                    serialPort.emit("data", "rom: 28 FF 40 F6 64 15 2 4D");
                }, 2020);
                setTimeout(function(){
                    serialPort.emit("data", "ts: 2016-02-12T15:08:52.985Z");
                }, 2030);
                setTimeout(function(){
                    serialPort.emit("data", "temperature: 20.44");
                }, 2040);
                setTimeout(function(){
                    serialPort.emit("data", "</data>");
                }, 2050);


                setTimeout(function(){
                    serialPort.emit("data", "<data>");
                }, 4000);
                setTimeout(function(){
                    serialPort.emit("data", "chip: dht11");
                }, 4010);
                setTimeout(function(){
                    serialPort.emit("data", "ts: 2016-02-12T15:08:52.985Z");
                }, 4030);
                setTimeout(function(){
                    serialPort.emit("data", "temperature: 21.44");
                }, 4040);
                setTimeout(function(){
                    serialPort.emit("data", "humidity: 70.44");
                }, 4045);
                setTimeout(function(){
                    serialPort.emit("data", "</data>");
                }, 4050);
*/

            });

            break;
        }
    }

    if (!foundArduino){
        saveToLog(new Error("No arduino found"));
        return;
    }
});

process.on("SIGINT", function(){
    console.log("Goodbye");
    process.exit();
});

function parseData(line) {

    var a = line.split(":");
    console.log(Date.now() + ": " + line);

    if (a[0].indexOf("<data>")!==-1) {
        obj = {};
    } else if (a[0].indexOf("</data>")!==-1 && obj) {
        //saveToLog(_.clone(obj));
        pushToBundle(_.clone(obj));
    }

    if (obj && a[0] !== undefined && a[1] !== undefined) {
        obj[a[0].trim().toLowerCase()] = a[1].trim();
    }
}

/*
function pushToBundle(obj){

    console.log("save in t_raw");
    console.log(obj);

    // initiate the cycle
    if(obj["chip"].toLowerCase() === "sht1x"){
        bundle = [];
        bundle.push(obj);
        cycleIsRunning = true;
    }

TODO: ...
    // finalize tue cycle
    if(obj["chip"].toLowerCase() === "ds18b20" && 
        obj["rom"].toLowerCase().indexOf("5f")!==-1 &&
        cycleIsRunning === true){

        bundle.push(obj);
        bundles.push(bundle);

        if(bundles.length === 10){
            calculateStatistics();
        }
        cycleIsRunning = false;
    }

}
*/

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

    // else{
    //     var line = "";
    //     line += (obj["chip"]        || "") + ",";
    //     line += (obj["rom"]         || "") + ",";
    //     line += (obj["ts"]          || "") + ",";
    //     line += (obj["temperature"] || "") + ",";
    //     line += (obj["humidity"]    || "") + "\n";

    //     Fs.appendFileAsync(csvPath, line)
    //         .then(function(){
    //             console.log("Data saved to CSV file");
    //         });        
    // }

}


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

/*
var loop = false;
function saveToPostgres(obj){

    if(obj instanceof Error){
        var insert = `
            INSERT INTO errors(data) VALUES('${ JSON.stringify(obj, ["message", "ts"]) }');
        `;
    }
    else{
        var insert = `
            INSERT INTO readings(data) VALUES('${ JSON.stringify(obj) }');
        `;
    }

    Db.query(insert)
        .then(function(){

            console.log("Data saved in postgres");
        })
        .catch(function(err){

            if(loop===false){
                loop = true;
                saveToLog(err);
            }
            
        });
}
*/
function ensureDataFiles(){
    
    Fs.ensureFileSync(logFilePath);

/*
    Fs.ensureFileSync(csvPath);

    // make sure the csv file has the header
    var stats = Fs.statSync(csvPath);
    if(stats.size===0){
        var header="ts,t_4d,t_6a,t_5f,t_sht1x,h_sht1x,t_sht1x2,h_sht1x2,t_sht1x3,h_sht1x3\n";
        Fs.writeFileSync(csvPath, header);
    }
*/
}
