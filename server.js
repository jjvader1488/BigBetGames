// server.js
const express = require('express');
const path = require('path');

const app = express();

// Use the dynamic port Railway provides, fallback to 3000 locally
const PORT = process.env.PORT || 3000;

// Serve static files from the Public folder
app.use(express.static(path.join(__dirname, 'Public')));

// Serve Mines page explicitly
app.get('/Mines', (req, res) => {
  res.sendFile(path.join(__dirname, 'Public', 'Mines', 'index.html'));
});

// Optional: route for any other pages you want
// e.g., app.get('/otherpage', (req, res) => { ... })

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
