// tests/bookingService.test.js
const bookingService = require('../services/bookingService');
const db = require('../db');

// 1. Mock the DB Module
// This stops the tests from actually trying to connect to Supabase
jest.mock('../db');

describe('Hotel Reservation System (Async/DB)', () => {
    
    let mockClient;

    // Helper to create a fake "Room" object
    const createRoom = (floor, pos, isOccupied = false) => ({
        number: (floor * 100) + pos,
        floor,
        pos,
        is_occupied: isOccupied
    });

    // Helper to generate the full 97-room hotel state
    const generateHotel = () => {
        let rooms = [];
        for (let f = 1; f <= 10; f++) {
            const limit = f === 10 ? 7 : 10;
            for (let p = 1; p <= limit; p++) {
                rooms.push(createRoom(f, p, false));
            }
        }
        return rooms;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // 2. Setup the "Mock Client" for Transactions
        // Since we use client.query('BEGIN'), we need to mock that specific object
        mockClient = {
            query: jest.fn(),
            release: jest.fn()
        };
        db.getClient.mockResolvedValue(mockClient);
    });

    test('Should fetch rooms correctly from DB', async () => {
        // Mock the DB returning 2 rooms
        const mockRooms = [createRoom(1, 1), createRoom(1, 2)];
        db.query.mockResolvedValue({ rows: mockRooms });

        const result = await bookingService.getRooms();
        
        expect(result).toHaveLength(2);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM rooms'));
    });

    test('Priority 1: Should book contiguous rooms on the same floor', async () => {
        // SCENARIO: Empty hotel. Request 3 rooms.
        // Expect: 101, 102, 103.
        
        // Mock the "SELECT ... FOR UPDATE" to return a full empty hotel
        mockClient.query.mockImplementation((sql) => {
            if (sql.includes('SELECT')) {
                return { rows: generateHotel() }; // Return all 97 empty rooms
            }
            return { rows: [] }; // For BEGIN, COMMIT, UPDATE
        });

        const booked = await bookingService.bookRooms(3);

        // Assertions
        expect(booked.map(r => r.number)).toEqual([101, 102, 103]);
        
        // Verify Transaction Lifecycle
        expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
        expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('COMMIT'));
        expect(mockClient.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE rooms SET'),
            expect.any(Array) // <--- Accepts the second argument (the room IDs)
        );
        expect(mockClient.release).toHaveBeenCalled();
    });

    test('Priority 2: Should cross floors if optimal (Minimize Vertical Cost)', async () => {
        // SCENARIO: Floor 1 is full. Floor 2 has 201. Floor 3 has 301.
        // Request 2 rooms.
        // Should pick 201 + 301 (Vertical Cost 2) over spreading further.

        const hotel = generateHotel();
        // Mark all Floor 1 as occupied
        hotel.filter(r => r.floor === 1).forEach(r => r.is_occupied = true);
        // Occupy almost everything else to force the specific choice
        // Let's just leave 201 and 301 open for simplicity in the mock
        const sparseHotel = hotel.map(r => {
            if (r.number === 201 || r.number === 301) return { ...r, is_occupied: false };
            return { ...r, is_occupied: true };
        });

        mockClient.query.mockImplementation((sql) => {
            if (sql.includes('SELECT')) return { rows: sparseHotel };
            return { rows: [] };
        });

        const booked = await bookingService.bookRooms(2);
        
        const sortedNumbers = booked.map(r => r.number).sort();
        expect(sortedNumbers).toEqual([201, 301]);
    });

    test('Transaction Safety: Should ROLLBACK on error', async () => {
        // SCENARIO: Database fails during the UPDATE step
        mockClient.query.mockImplementation((sql) => {
            if (sql.includes('SELECT')) return { rows: generateHotel() };
            if (sql.includes('UPDATE')) throw new Error("DB Connection Lost");
            return { rows: [] };
        });

        await expect(bookingService.bookRooms(2))
            .rejects
            .toThrow("DB Connection Lost");

        // Verify Rollback was called
        expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
        expect(mockClient.release).toHaveBeenCalled();
    });
});