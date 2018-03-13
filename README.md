# webhooks-queue
Service to store and run webhooks with Node.js and Cassandra

# Technology stack
+ [NodeJS](https://nodejs.org/en/) 8.10.x
+ [Express](http://expressjs.com/) web framework package
+ Database [Apache Cassandra](http://cassandra.apache.org/) 3.x

# Setting up
```bash
cd /var
sudo git clone https://github.com/ecomclub/webhooks-queue
cqlsh
SOURCE '/var/webhooks-queue/cassandra/tables.cql'
EXIT
sudo node /var/webhooks-queue/nodejs/main.js tcp-port
```

Replace `tcp-port` with the port number you want to use,
you should protect it with firewall, passing only trusted IPs.

Optionaly, you can change the sample `/var` directory to what you want.
