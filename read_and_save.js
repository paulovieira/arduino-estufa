const Readline = require('readline');
var Path = require("path");
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs-extra'));
var SP = require("serialport");
var Db = require("./config/db");

var csvPath = Path.join(__dirname, "./data/arduino.csv");
var configPath = Path.join(__dirname, "./config/defaults");
var errorsPath = Path.join(__dirname, "./data/errors.log");

var Config = require(configPath);

var obj = {};

process.title = "estufa_read";

ensureCSV();

SP.list(function(err, ports){

    if (err) {
        console.err("Could not list the serial ports: \n", err.message);
        err["ts"] = new Date().toISOString();
        Fs.appendFile(errorsPath, JSON.stringify(err, 0, 4) + "\n\n");
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
                    console.log("Failed to open connection: " + error);
                    err["ts"] = new Date().toISOString();
                    Fs.appendFile(errorsPath, JSON.stringify(err, 0, 4) + "\n\n");
                    return;
                }

                console.log("Connection successful");
                serialPort.on("data", parseData);

            });

            break;
        }
    }

    if (!foundArduino){
		console.log("No arduino found");
        obj["chip"] = "NONE";
        saveData(obj);
    }
});

process.on("SIGINT", function(){
    console.log("Goodbye");
    process.exit();
});

function parseData(line) {

    var a = line.split(":");
    //console.log(Date.now() + ": " + line);

    if (a[0].indexOf("<data>")!==-1) {
        obj = {};
    } else if (a[0].indexOf("</data>")!==-1 && obj) {
        saveData(obj);
    }

    if (obj && a[0] !== undefined && a[1] !== undefined) {
        obj[a[0].trim()] = a[1].trim();
    }
}

function saveData(obj) {
    obj["ts"] = new Date().toISOString();
    console.log(obj);

    saveToCSV(obj);
    saveToPostgres(obj);
}

function ensureCSV(){
    
    Fs.ensureFileSync(csvPath);
    var stats = Fs.statSync(csvPath);
    if(stats.size===0){
        var header = "chip,rom,ts,temperature,humidity\n";
        Fs.writeFileSync(csvPath, header);
    }
}

function saveToCSV(obj){

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

function saveToPostgres(obj){

    var insert = `
        INSERT INTO readings(data) VALUES('${ JSON.stringify(obj) }');
    `;
    Db.query(insert)
        .then(function(){

            console.log("Data saved in postgres");
        })
        .catch(function(err){

            err["ts"] = new Date().toISOString();
            console.log(JSON.stringify(err, 0, 4));
            Fs.appendFile(errorsPath, JSON.stringify(err, 0, 4) + "\n\n");
        });
}
