# Hotel Room Reservation System (SDE 3 Assessment)

## 📋 Project Overview
This repository contains a full-stack solution for the **Hotel Room Reservation** assessment. It is a system designed to optimize room allocation based on proximity constraints to minimize guest travel time.

The solution allows users to book up to 5 rooms at a time, enforcing specific layout constraints (e.g., Floor 10 has only 7 rooms) and prioritizing bookings on the same floor or minimizing vertical travel time across floors.

### 🚀 Key Features
* **Optimal Room Allocation:** Implements a weighted cost algorithm ($Cost = 2 \times Vertical + 1 \times Horizontal$) to minimize travel time.
* **Constraint Enforcement:** Strictly manages the 97-room limit and specific floor layouts.
* **Concurrency Safe:** Uses PostgreSQL transactions (`FOR UPDATE`) to prevent double-booking race conditions.
* **Interactive Visualization:** Real-time 10x10 grid visualizing occupancy and booking status.
* **Simulation Tools:** "Randomize" and "Reset" buttons to test system resilience and edge cases.

---

## 🛠️ Tech Stack

### Backend (`/hotel-reservation-api`)
* **Runtime:** Node.js (v18+)
* **Framework:** Express.js
* **Database:** PostgreSQL (Supabase)
* **Driver:** `pg` (node-postgres)
* **Testing:** Jest (Unit & Integration Mocks)

### Frontend (`/hotel-reservation-client`)
* **Framework:** Angular 18 (Standalone Components)
* **Language:** TypeScript
* **Styling:** CSS Grid & Flexbox
* **HTTP:** Angular `HttpClient`

---

## 📂 Project Structure

```bash
/
├── hotel-reservation-api/       # Backend Application
│   ├── services/                # Core Business Logic & Algorithms
│   ├── tests/                   # Jest Test Suite
│   ├── db.js                    # Database Connection Pool
│   └── server.js                # API Entry Point
│
└── hotel-reservation-client/    # Frontend Application
    ├── src/app/
    │   ├── booking.service.ts   # API Consumer
    │   └── app.component.ts     # View Logic & Grid State
    └── package.json