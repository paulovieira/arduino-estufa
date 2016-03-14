process.title = "estufa_read";

var Path = require("path");
var _ = require("underscore");
var Promise = require('bluebird');

var Fs = Promise.promisifyAll(require('fs-extra'));
var SP = require("serialport");
var Db = require("./config/db");

var csvPath = Path.join(__dirname, "./data/arduino.csv");
var configPath = Path.join(__dirname, "./config/defaults");
var errorsPath = Path.join(__dirname, "./data/errors.log");

//var Config = require(configPath);

var obj = {};
var bundle = [];
var cycleIsRunning = false;

ensureDataFiles();

SP.list(function(err, ports){

    if (err) {
        console.err("Could not list the serial ports: \n", err.message);
        saveData(err);
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
                    console.log("Failed to open connection: " + err.message);
                    saveData(err);
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
		console.log("No arduino found");
        saveData(new Error("No arduino found"));
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
        //saveData(_.clone(obj));
        pushToBundle(_.clone(obj));
    }

    if (obj && a[0] !== undefined && a[1] !== undefined) {
        obj[a[0].trim().toLowerCase()] = a[1].trim();
    }
}


function pushToBundle(obj){

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

function calculateStatistics(){

}

function saveData(obj) {
    obj["ts"] = new Date().toISOString();
    console.log(obj);

    saveToFile(obj);
    saveToPostgres(obj);
}


function saveToFile(obj){

    if(obj instanceof Error){
        Fs.appendFile(errorsPath, JSON.stringify(obj, ["message", "ts"], 4) + "\n\n");
    }
    else{
        var line = "";
        line += (obj["chip"]        || "") + ",";
        line += (obj["rom"]         || "") + ",";
        line += (obj["ts"]          || "") + ",";
        line += (obj["temperature"] || "") + ",";
        line += (obj["humidity"]    || "") + "\n";

        Fs.appendFileAsync(csvPath, line)
            .then(function(){
                console.log("Data saved to CSV file");
            });        
    }

}

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
                saveData(err);
            }
            
        });
}

function ensureDataFiles(){
    
    Fs.ensureFileSync(errorsPath);
    Fs.ensureFileSync(csvPath);

    // make sure the csv file has the header
    var stats = Fs.statSync(csvPath);
    if(stats.size===0){
        var header = "chip,rom,ts,temperature,humidity\n";
        Fs.writeFileSync(csvPath, header);
    }
}
