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
  date_time timestamp,
  PRIMARY KEY (store_id, id)
) WITH CLUSTERING ORDER BY (id DESC);

CREATE TABLE IF NOT EXISTS queue (
  trigger_id varchar,
  store_id int,
  uri varchar,
  headers varchar,
  method varchar,
  body text,
  date_time timestamp,
  PRIMARY KEY (trigger_id, date_time)
) WITH CLUSTERING ORDER BY (date_time ASC);

CREATE INDEX ON queue (store_id);
