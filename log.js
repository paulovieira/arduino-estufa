var Path = require("path");
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs-extra'));
var Db = require("./config/db");

var internals = {};
internals.logFilePath = Path.resolve("./data/log.txt");

module.exports = function save(obj, keys) {

    var data;
    if(!keys){
        keys = ["message", "ts"];
    }
    if(obj instanceof Error){
        obj["ts"] = new Date().toISOString();
        data = JSON.stringify(obj, keys, 4);
    }
    else{
        throw new Error("obj should be an error instance");
    }

    console.log(data);

    internals.saveToLogFile(data + "\n\n");
    internals.saveToLogTable(data);
};


internals.saveToLogFile = function saveToLogFile(data){

    Fs.appendFileAsync(internals.logFilePath, data)
        .then(function(){
            console.log("Data saved in the log file");
        })
        .catch(function(){
            console.log("Data not saved in the log file")
        });
};

internals.saveToLogTable = function saveToLogTable(data){

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
};
