const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(express.json());
app.use(cors());

const db = new sqlite3.Database('./houses.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    db.run(
      `CREATE TABLE IF NOT EXISTS houses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        image TEXT,
        price TEXT,
        location TEXT
      )`,
      (err) => {
        if (err) {
          console.error('Error creating table:', err);
        }
      }
    );
  }
});

app.get('/houses', (req, res) => {
  db.all('SELECT * FROM houses', (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch houses' });
    } else {
      res.json(rows);
    }
  });
});

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
});

app.post('/houses', (req, res) => {
  const { name, image, price, location } = req.body;

  db.run(
    `INSERT INTO houses (name, image, price, location) VALUES (?, ?, ?, ?)`,
    [name, image, price, location],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to add house' });
      }

      const newHouse = {
        id: this.lastID,
        name,
        image,
        price,
        location,
      };

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ action: 'add', house: newHouse }));
        }
      });

      res.status(201).json(newHouse);
    }
  );
});

app.delete('/houses/:id', (req, res) => {
  const houseId = req.params.id;

  db.run(`DELETE FROM houses WHERE id = ?`, [houseId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete house' });
    }

    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ action: 'delete', id: houseId }));
      }
    });

    res.status(200).json({ message: 'House deleted successfully', id: houseId });
  });
});


const PORT = 4000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
