var Dns = require("dns");
var Shell = require("shelljs")
var Log = require("./log");

Dns.lookup("google.com", {family: 4}, function(err, address, family) {

    if(err){
        Log(err, ["message", "code", "errno", "syscall", "ts"]);

        // renew the ip address
        var output = Shell.exec("sudo /sbin/dhclient -r -v");
        console.log("output from dhclient\n", output);
	    //output["ts"] = new Date().toISOString();
        //Fs.appendFile(errorsPath, JSON.stringify(output, null, 4) + "\n\n");
	
    }

});
