// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bookingService = require('./services/bookingService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- ROUTES ---

/**
 * GET /rooms
 * Returns the current state of all rooms (occupied vs free)
 * Used for: Visualization grid
 */
app.get('/rooms', async (req, res) => {
    try {
        const rooms = await bookingService.getRooms();
        res.json({ data: rooms });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /book
 * Accepts: { "numRooms": 3 }
 * Returns: { "booked": [101, 102, 103] }
 */
app.post('/book', async (req, res) => {
    try {
        const { numRooms } = req.body;
        // Validation...
        const bookedRooms = await bookingService.bookRooms(parseInt(numRooms)); // await here
        res.json({ 
            success: true, 
            booked: bookedRooms.map(r => r.number) 
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

/**
 * POST /random
 * Randomly fills the hotel to simulate usage
 */
app.post('/random', async (req, res) => {
    const result = await bookingService.randomize();
    res.json(result);
});

/**
 * POST /reset
 * Clears all bookings
 */
app.post('/reset', async (req, res) => {
    const result = await bookingService.reset();
    res.json(result);
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});