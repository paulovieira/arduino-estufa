process.title = "arduino_read";

var Path = require("path");
var _ = require("underscore");
var Promise = require('bluebird');

var Fs = Promise.promisifyAll(require('fs-extra'));
var SP = require("serialport");
var Db = require("./config/db");
var Log = require("./log");


var obj = undefined;


SP.list(function(err, ports){

    if (err) {
        console.err("Could not list the serial ports: \n", err.message);
        Log(err);
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
                    Log(err);
                    return;
                }

                console.log("Connection successful");
                serialPort.on("data", parseData);

            });

            break;
        }
    }

    if (!foundArduino){
        Log(new Error("No arduino found"));
        return;
    }
});

process.on("SIGINT", function(){
    console.log("Goodbye");
    process.exit();
});


// see at the end of the file an example of how the data is arriving to the pi
function parseData(line) {

    console.log(Date.now() + ": " + line);
    var a = line.split(":");

    if (a[0].indexOf("<data>")!==-1) {
        obj = {};
    } 
    else if (a[0].indexOf("</data>")!==-1 && obj) {
        saveToRawTable(_.clone(obj));
        obj = undefined;
    }
    else if (obj && a[0] !== undefined && a[1] !== undefined) {
        obj[a[0].trim().toLowerCase()] = a[1].trim();
    }
    else{
        console.log("Received a line but the <data> separator was missing. Discarding.")
    }
}



function saveToRawTable(obj){

    obj = _.defaults(obj, {chip: "", rom: "", temperature: "", humidity: ""});

    // if this is a reading from the DS18B20 sensor, we have to store the ROM to identify them; it will be 
    // something like "28 FF E2 94 64 15 2 6A" but we only care about the last segment
    if(obj["rom"]){
        obj["rom"] = obj["rom"].split(" ").pop();
    }

    var insert = `
        INSERT INTO t_raw(chip, rom, temperature, humidity) VALUES('${ obj["chip"] }', '${ obj["rom"] }', '${ obj["temperature"] }', '${ obj["humidity"] }');
    `;   

    console.log("insert: ", insert)

    Db.query(insert)
        .then(function(){
            console.log("Data saved in the t_raw table");
        })
        .catch(function(err){
            console.log("Data not saved in the t_raw table");
        });
}





/*
1458134666764: <data>
1458134666776: chip: SHT1x
1458134666796: temperature: 20.64
1458134666817: humidity: 63.12
1458134666826: </data>
saveToRawTable
{"chip":"SHT1x","temperature":"20.64","humidity":"63.12"}
1458134666833: <data>
1458134666846: chip: SHT1x2
1458134666870: temperature: 19.92
1458134666887: humidity: 64.04
1458134666895: </data>
saveToRawTable
{"chip":"SHT1x2","temperature":"19.92","humidity":"64.04"}
1458134666903: <data>
1458134666919: chip: SHT1x3
1458134666940: temperature: 20.04
1458134666956: humidity: 65.19
1458134666964: </data>
saveToRawTable
{"chip":"SHT1x3","temperature":"20.04","humidity":"65.19"}
1458134666972: <data>
1458134666989: chip: DS18B20
1458134667022: rom: 28 FF 40 F6 64 15 2 4D 
1458134668001: temperature: 19.81
1458134668013: </data>
saveToRawTable
{"chip":"DS18B20","rom":"28 FF 40 F6 64 15 2 4D","temperature":"19.81"}
1458134668021: <data>
1458134668033: chip: DS18B20
1458134668066: rom: 28 FF E2 94 64 15 2 6A 
1458134669045: temperature: 20.69
1458134669057: </data>
saveToRawTable
{"chip":"DS18B20","rom":"28 FF E2 94 64 15 2 6A","temperature":"20.69"}
1458134669065: <data>
1458134669078: chip: DS18B20
1458134669110: rom: 28 FF 91 F3 64 15 2 5F 
1458134670095: temperature: 19.81
1458134670102: </data>

*/