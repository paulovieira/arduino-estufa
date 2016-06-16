#!/bin/bash
ps -aux | gawk '$11 == "arduino_read" { print $2}' | sudo xargs kill --signal SIGINT;
sleep 1s;

# cwd should be the adjusted before the script is executed
node ./arduino_read.js;
