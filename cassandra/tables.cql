CREATE KEYSPACE webhooks WITH REPLICATION = { 'class' : 'NetworkTopologyStrategy', 'datacenter1' : 1 };

USE webhooks;

CREATE TABLE IF NOT EXISTS history (
  id bigint,
  trigger_id varchar,
  store_id int,
  uri varchar,
  headers varchar,
  method varchar,
  body text,
  status_code smallint,
  response text,
  error varchar,
  date_time timestamp,
  PRIMARY KEY (store_id, id)
) WITH CLUSTERING ORDER BY (id DESC);
