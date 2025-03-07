const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const mqtt = require("mqtt");
const cors = require("cors");

const app = express();
const port = 3001;
app.use(express.json());
app.use(cors());

// Initialize SQLite Database
const db = new sqlite3.Database("weather.db", (err) => {
  if (err) console.error("Database connection error:", err);
  else console.log("Connected to SQLite database");
});

// Create Table
db.run(
  `CREATE TABLE IF NOT EXISTS weather (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temperature REAL,
    humidity REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
);

// Connect to MQTT
const mqttClient = mqtt.connect("ws://157.173.101.159:9001");

mqttClient.on("connect", () => {
  console.log("Connected to MQTT Broker");
  mqttClient.subscribe("/work_group_01/room_temp/temperature");
  mqttClient.subscribe("/work_group_01/room_temp/humidity");
});

let tempReadings = [];
let humidityReadings = [];

mqttClient.on("message", (topic, message) => {
  const value = parseFloat(message.toString());

  if (topic === "/work_group_01/room_temp/temperature") {
    tempReadings.push(value);
  } else if (topic === "/work_group_01/room_temp/humidity") {
    humidityReadings.push(value);
  }
});

// Store averaged data every 5 minutes
setInterval(() => {
  if (tempReadings.length > 0 && humidityReadings.length > 0) {
    const avgTemp =
      tempReadings.reduce((sum, val) => sum + val, 0) / tempReadings.length;
    const avgHumidity =
      humidityReadings.reduce((sum, val) => sum + val, 0) /
      humidityReadings.length;

    db.run(
      `INSERT INTO weather (temperature, humidity) VALUES (?, ?)`,
      [avgTemp, avgHumidity],
      (err) => {
        if (err) console.error("Error inserting data:", err);
        else
          console.log(
            "Stored Avg Temp:",
            avgTemp,
            "Avg Humidity:",
            avgHumidity
          );
      }
    );

    // Clear old readings
    tempReadings = [];
    humidityReadings = [];
  }
}, 300000); 

// Fetch Data
app.get("/weather", (req, res) => {
  db.all(
    "SELECT * FROM weather ORDER BY timestamp DESC LIMIT 12",
    [],
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(rows);
    }
  );
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
