#!/bin/bash
ps -aux | gawk '$11 == "estufa_read" { print $2}' | xargs kill --signal SIGINT;
sleep 1s;

# cwd should be the adjusted before the script is executed
node ./read_and_save.js;
