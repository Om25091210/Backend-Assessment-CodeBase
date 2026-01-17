// services/bookingService.js
const _ = require('lodash');
const db = require('../db');

class BookingService {
    
    /**
     * Fetch all rooms from DB to build the grid state
     */
    async getRooms() {
        const result = await db.query('SELECT * FROM rooms ORDER BY floor ASC, pos ASC');
        return result.rows;
    }

    async reset() {
        await db.query('UPDATE rooms SET is_occupied = false');
        return { message: "All rooms reset" };
    }

    async randomize() {
        // Reset first
        await db.query('UPDATE rooms SET is_occupied = false');
        // Randomly occupy ~30% of rooms using SQL random()
        await db.query('UPDATE rooms SET is_occupied = true WHERE random() < 0.3');
        return { message: "Random occupancy generated" };
    }

    /**
     * MAIN BOOKING LOGIC (Now with Transactions)
     */
    async bookRooms(numRooms) {
        if (numRooms > 5) throw new Error("Max 5 rooms per booking");

        const client = await db.getClient();

        try {
            // 1. START TRANSACTION
            await client.query('BEGIN');

            // 2. LOCK ROWS: Select all rooms. 
            // "FOR UPDATE" locks these rows so no one else can book them while we decide.
            const res = await client.query('SELECT * FROM rooms ORDER BY floor ASC, pos ASC FOR UPDATE');
            const allRooms = res.rows;

            // 3. RUN ALGORITHM (Exact same logic, just using DB data)
            const availableRooms = allRooms.filter(r => !r.is_occupied);
            
            if (availableRooms.length < numRooms) {
                throw new Error("Not enough rooms available");
            }

            let bestBooking = null;
            let minCost = Infinity;

            // --- Strategy 1: Same Floor ---
            const roomsByFloor = _.groupBy(availableRooms, 'floor');
            
            for (const floor in roomsByFloor) {
                const floorRooms = _.sortBy(roomsByFloor[floor], 'pos');
                if (floorRooms.length >= numRooms) {
                    for (let i = 0; i <= floorRooms.length - numRooms; i++) {
                        const candidateSet = floorRooms.slice(i, i + numRooms);
                        const cost = this.calculateTravelTime(candidateSet);
                        if (cost < minCost) {
                            minCost = cost;
                            bestBooking = candidateSet;
                        }
                    }
                }
            }

            // --- Strategy 2: Cross Floor ---
            if (!bestBooking) {
                minCost = Infinity; 
                for (const pivot of availableRooms) {
                    const neighbors = availableRooms
                        .filter(r => r.number !== pivot.number)
                        .map(r => ({
                            room: r,
                            distance: this.calculatePairCost(pivot, r)
                        }));
                    
                    const closest = _.sortBy(neighbors, 'distance').slice(0, numRooms - 1);
                    
                    if (closest.length === numRooms - 1) {
                        const candidateSet = [pivot, ...closest.map(c => c.room)];
                        const totalSetCost = this.calculateTravelTime(candidateSet);

                        if (totalSetCost < minCost) {
                            minCost = totalSetCost;
                            bestBooking = candidateSet;
                        }
                    }
                }
            }

            if (!bestBooking) {
                throw new Error("Unable to find suitable booking");
            }

            // 4. PERSIST CHANGES
            const roomNumbers = bestBooking.map(r => r.number);
            
            // Update only the selected rooms
            await client.query(
                'UPDATE rooms SET is_occupied = true WHERE number = ANY($1)',
                [roomNumbers]
            );

            // 5. COMMIT TRANSACTION
            await client.query('COMMIT');
            
            return bestBooking;

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }

    // --- Helper Math Functions (Same as before) ---
    calculateTravelTime(rooms) {
        if (!rooms || rooms.length === 0) return 0;
        const sorted = _.orderBy(rooms, ['floor', 'pos'], ['asc', 'asc']);
        return this.calculatePairCost(sorted[0], sorted[sorted.length - 1]);
    }

    calculatePairCost(r1, r2) {
        const vertical = Math.abs(r1.floor - r2.floor) * 2;
        const horizontal = Math.abs(r1.pos - r2.pos) * 1;
        return vertical + horizontal;
    }
}

module.exports = new BookingService();