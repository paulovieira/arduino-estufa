var Path = require("path");
var Dns = require("dns");
var Fs = require("fs-extra");
var Shell = require("shelljs")
var Db = require("./config/db");

var errorsPath = Path.join(__dirname, "./data/errors.log");

Dns.lookup("google.com", {family: 4}, function(err, address, family) {

    if(err){
        err["ts"] = new Date().toISOString();
        console.log(JSON.stringify(err, ["message", "code", "errno", "syscall", "ts"], 4));

        Fs.appendFile(errorsPath, JSON.stringify(err, ["message", "code", "errno", "syscall", "ts"], 4) + "\n\n");
        Db.query(`INSERT INTO errors(data) VALUES('${ JSON.stringify(err, ["message", "code", "errno", "syscall", "ts"]) }');`)

        var output = Shell.exec("sudo /sbin/dhclient -r -v");
	output["ts"] = new Date().toISOString();
        Fs.appendFile(errorsPath, JSON.stringify(output, null, 4) + "\n\n");
	
    }

});
