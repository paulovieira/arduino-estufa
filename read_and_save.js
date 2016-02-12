var SP = require("serialport");
var Fs = require("fs-extra");
var Pg = require("pg");
var Config = require("./config/defaults");
var arduinoPort = {};
var obj;
var serialPort;
var csvPath = "data/arduino.csv";

console.log(Config);

ensureCSV();

SP.list(function(err, ports){

    if (err) {
        console.err("Could not list the serial ports: \n", err.message);
        return;
    }

	var foundArduino = false;
    for (var i = 0; i < ports.length; i++) {
        if (ports[i].pnpId !== undefined && ports[i].manufacturer.toLowerCase().indexOf("arduino") !== -1) {

			foundArduino = true;
            console.log("Found an Arduino:\n", JSON.stringify(ports[i], 0, 4));
            
            arduinoPort = ports[i];

            // register callback to listen for the "data" event
            console.log("Opening new connection to " + arduinoPort.comName);

            var options = {
                baudrate: 9600,
                parser: SP.parsers.readline("\n")
            };

            serialPort = new SP.SerialPort(arduinoPort.comName, options, false);
            serialPort.open(function(error) {

                if (error) {
                    console.log("Failed to open connection: " + error);
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
    }
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
    obj["memoryUsage"] = process.memoryUsage();
    console.log(obj);

    saveToCSV(obj);
    saveToPostgres(obj);
}

function ensureCSV(){

	Fs.ensureFileSync(csvPath);
	var CSV = Fs.readFileSync(csvPath, "utf8");
	if(CSV===""){
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

	Fs.appendFile(csvPath, line);
}

function saveToPostgres(obj){

    Pg.connect(Config.pg, function(err, client, done) {

        if (err) {
            console.error("PG: couldn't fetch a client from pool", err);
            return;
        }

        var query = `
            INSERT INTO readings(data) VALUES('${ JSON.stringify(obj) }');
        `;

        client.query(query, undefined, function(err, result) {

            //call `done()` to release the client back to the pool
            done();

            if (err) {
                return console.error('Error running query', err);
            }

        });
    });

}
