process.title = "arduino_average";

var Path = require("path");
var _ = require("underscore");
var Promise = require('bluebird');

var Fs = Promise.promisifyAll(require('fs-extra'));
var Db = require("./config/db");
var Log = require("./log");

var Config = require(Path.resolve("./config/defaults"));
var csvPath = Path.resolve("./data/readings.csv");
//var configPath = Path.resolve("./config/defaults");
//var logFilePath = Path.resolve("./data/log.txt");

var uploadInterval = Config.uploadInterval;
if(!uploadInterval){
    var err = new Error("upload interval is not defined")
    Log(err);
}

ensureDataFiles();



Promise.all([getAverageSHT(), getAverageDS18B20()])
    .then(function(data){

        // console.log("data[0]\n", data[0])
        // console.log("data[1]\n", data[1])

        var temp = _.extend({}, _.indexBy(data[0], "chip"), _.indexBy(data[1], "rom"));
        //console.log("temp\n", temp);

	// get a timestamp in ISO8601 (removing the timezone and taking into account the daylight saving period)
	var now = new Date();
	var tzoffset = (now.getTimezoneOffset()*60000);  // will be "-60" for the summer hour
	var ts = (new Date(now - tzoffset)).toISOString().slice(0,-5);
	
        var obj = {
            ts: ts
        };
        for(var key in temp){
            for(var key2 in temp[key]){
                delete temp[key]["chip"];
                delete temp[key]["rom"];
            }

            obj[key.toLowerCase()] = temp[key];
        }

        ["sht1x", "sht1x2", "sht1x3"].forEach(function(key){
            obj[key] = _.defaults(obj[key] || {}, {temperature: '', humidity: ''})
        });

        ["4d", "5f", "6a"].forEach(function(key){
            obj[key] = _.defaults(obj[key] || {}, {temperature: ''})
        });


        console.log("obj\n", obj);

        var insert = `
            INSERT INTO t_avg(data) VALUES('${ JSON.stringify(obj) }'); 
        `;

        Db.query(insert)
            .then(function(){

                var deleteQuery = `
                    DELETE FROM t_raw; 
                `;      
                return Db.query(deleteQuery);
            })
            .then(function(){
                console.log("Data saved in the t_avg table");
            })
            .catch(function(err){
                console.log("Data not saved in the t_avg table");
            });

        var line = `${ obj["ts"] },${ obj["4d"]["temperature"] },${ obj["5f"]["temperature"] },${ obj["6a"]["temperature"] },${ obj["sht1x"]["temperature"] },${ obj["sht1x"]["humidity"] },${ obj["sht1x2"]["temperature"] },${ obj["sht1x2"]["humidity"] },${ obj["sht1x3"]["temperature"] },${ obj["sht1x3"]["humidity"] }\n`;

        Fs.appendFileAsync(csvPath, line)
            .then(function(){
                console.log("Data saved in the csv file");
            })
            .catch(function(){
                console.log("Data not saved in the csv file")
            });


    })
    .catch(function(err){
        //throw err;
        Log(err);
    });


function getAverageSHT(obj){

    // average for the sensors with SHT1x chips
    var avgQuery = `

select chip, 
    round( avg(temperature::real)::numeric, 1) temperature, 
    round( avg(humidity::real)::numeric, 1) humidity
from t_raw 
where ts > now() - '${ uploadInterval } minute'::interval
    and temperature::real between -5 and 50
    and humidity::real between -5 and 105
    and chip ilike 'sht%'
group by chip
order by chip;

    `;
    return Db.query(avgQuery)
        .then(function(obj){

            return obj;
        })
        .catch(function(err){

            throw err;
        });
};

function getAverageDS18B20(obj){

    // average for the sensors with DS18B20 chips
    var avgQuery = `

select chip, 
    rom, 
    round( avg(temperature::real)::numeric, 1) temperature
from t_raw 
where ts > now() - '${ uploadInterval } minute'::interval
    and temperature::real between -5 and 50
    and chip ilike 'ds18b20'
group by chip, rom
order by rom;

    `;

    return Db.query(avgQuery)
        .then(function(obj){

            return obj;
        })
        .catch(function(err){

            throw err;
        });
};

function ensureDataFiles(){
    
    Fs.ensureFileSync(csvPath);

    // make sure the csv file has the header
    var stats = Fs.statSync(csvPath);
    if(stats.size===0){
        var header="ts,temp_4d,temp_5f,temp_6a,temp_sht1x,hum_sht1x,temp_sht1x2,hum_sht1x2,temp_sht1x3,hum_sht1x3\n";
        Fs.writeFileSync(csvPath, header);
    }

}



/*
var obj = undefined;

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


// see at the end of the file an example of how the data is arriving to the pi
function parseData(line) {

    console.log(Date.now() + ": " + line);
    var a = line.split(":");

    if (a[0].indexOf("<data>")!==-1) {
        obj = {};
    } 
    else if (a[0].indexOf("</data>")!==-1 && obj) {
        //saveToLog(_.clone(obj));
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
            console.log("Data saved in the t_log table");
        })
        .catch(function(err){
            console.log("Data not saved in the t_log table");
        });
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

function ensureDataFiles(){
    
    Fs.ensureFileSync(logFilePath);

}
*/


