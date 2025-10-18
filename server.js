// server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000; // you can change this port if you want

// Serve static files from the Public folder
app.use(express.static(path.join(__dirname, 'Public')));

// Optional: serve Mines page if you navigate directly
app.get('/Mines', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public', 'Mines', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
