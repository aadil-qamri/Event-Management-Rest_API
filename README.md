# Event Management API

A simple REST API for managing events, users, and registrations built with **Node.js**, **Express**, and **PostgreSQL**.  

It supports creating events, registering users, canceling registrations, and retrieving event statistics, all while enforcing business rules like capacity limits, duplicate prevention, and past-event restrictions.

---

## Setup Instructions

### 1️⃣ Clone the Repository
```bash
git clone <your-repo-url>
cd <your-repo-folder>
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Setup PostgreSQL Database
- Create a PostgreSQL database (e.g., `event_management`).
- Run the following script in **pgAdmin** or `psql`: build-script.sql


### 4️⃣ Configure Environment Variables
Create a `.env` file in the project root:

```
DB_USER=postgres
DB_HOST=localhost
DB_NAME=events_db
DB_PASSWORD=your_password
DB_PORT=5432
```

### 5️⃣ Run the API
```bash
npm run start
```

The server should now be running at `http://localhost:5000`.

---

## API Description

### 1. Create Event
- **POST** `/events`
- **Body**: 
```json
{
  "title": "Hackathon",
  "description": "24-hour coding event",
  "location": "Downtown Tech Hub",
  "date": "2025-12-10T09:00:00.000Z",
  "capacity": 100
}
```
- **Response**:
```json
{
  "id": 1
}
```

### 2. Get All Upcoming Events
- **GET** `/events`
- Returns only future events, sorted by date then location, including registration counts.

### 3. Get Single Event Details
- **GET** `/events/:id`
- Returns all event fields + registrations count

### 4. Register for an Event
- **POST** `/events/:id/register`
- **Body**:
```json
{
  "name": "Aadil Ansari",
  "email": "aadil@example.com"
}
```
- Prevents duplicate registrations, full events, and past events.

### 5. Cancel Registration
- **DELETE** `/events/:id/register`
- **Body**:
```json
{
  "email": "aadil@example.com"
}
```
- Returns error if the user wasn’t registered

### 6. Event Stats
- **GET** `/events/:id/stats`
- Shows total registrations, remaining capacity, and percentage used

### 7. Update Event
- **PATCH** `/events/:id`
- Body: any fields (`title`, `description`, `location`, `date`, `capacity`)  
- Response: updated event object  

### 8. Delete Event
- **DELETE** `/events/:id`  
- Removes the event and all related registrations automatically  

---

**Fully Functional Event Management API!**
