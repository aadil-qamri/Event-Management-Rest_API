import express from "express";
import cors from "cors";
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());


// ------------------------ SQL Connection ----------------------- \\

const pool = new Pool({
	user: process.env.DB_USER,
	host: process.env.DB_HOST,
	database: process.env.DB_NAME,
	password: process.env.DB_PASSWORD,
	port: process.env.DB_PORT,
});

pool.connect()
	.then(() => console.log('Connected to PostgreSQL'))
	.catch(err => console.error('Connection error', err));


// ------------------------ Handling Request On events Endpoint ----------------------- \\


app.get('/events', async (req, res) => {
  const client = await pool.connect();
  try {
    const now = new Date();

    const result = await client.query(`
      SELECT 
        e.*,
        COUNT(r.id) AS registrations_count
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE e.date > $1
      GROUP BY e.id
      ORDER BY e.date ASC, e.location ASC
    `, [now]);

    const events = result.rows.map(row => ({
      ...row,
      registrations_count: parseInt(row.registrations_count, 10)
    }));

    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});



app.post('/events', async (req, res) => {
	const { title, description, date, location, capacity } = req.body;
	console.log(req.body)
	const result = await pool.query('INSERT INTO events (title, description, date, location, capacity) VALUES ($1, $2, $3, $4, $5) RETURNING *', [title, description, date, location, capacity])
	res.status(201).json(result.rows[0]);
})

// ------------------------ Handling Request On events:id Endpoint ----------------------- \\

app.get('/events/:id', async (req, res) => {
	const client = await pool.connect();
	try {
		const eventId = req.params.id;

		const result = await client.query(`
      SELECT 
        e.*, 
        COUNT(r.id) AS registrations_count
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE e.id = $1
      GROUP BY e.id
    `, [eventId]);

		if (result.rows.length === 0) {
			return res.status(404).json({ error: 'Event not found' });
		}

		const event = {
			...result.rows[0],
			registrations_count: parseInt(result.rows[0].registrations_count, 10)
		};

		res.json(event);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: 'Server error' });
	} finally {
		client.release();
	}
});


app.get('/events/:id/stats', async (req, res) => {
  const client = await pool.connect();
  try {
    const eventId = req.params.id;

    //  Fetch event
    const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [eventId]);
    const event = eventResult.rows[0];
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    //  Count registrations
    const countResult = await client.query(
      'SELECT COUNT(*) AS total_registrations FROM registrations WHERE event_id = $1',
      [eventId]
    );
    const totalRegistrations = parseInt(countResult.rows[0].total_registrations, 10);

    //  Calculate remaining capacity & percentage
    const remainingCapacity = event.capacity - totalRegistrations;
    const percentageUsed = ((totalRegistrations / event.capacity) * 100).toFixed(2);

    res.json({
      event_id: event.id,
      title: event.title,
      total_registrations: totalRegistrations,
      remaining_capacity: remainingCapacity,
      percentage_used: parseFloat(percentageUsed)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});




app.post('/events/:id/register', async (req, res) => {
	const client = await pool.connect();
	try {
		const { name, email } = req.body;
		const eventId = req.params.id;

		if (!name || !email) {
			return res.status(400).json({ error: 'Name and email are required.' });
		}

		await client.query('BEGIN');

		//  Check if event exists
		const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [eventId]);
		const event = eventResult.rows[0];
		if (!event) {
			await client.query('ROLLBACK');
			return res.status(404).json({ error: 'Event not found.' });
		}

		//  Prevent registration for past events
		const now = new Date();
		if (new Date(event.date) < now) {
			await client.query('ROLLBACK');
			return res.status(400).json({ error: 'Cannot register for past events.' });
		}

		//  Check current registrations count
		const countResult = await client.query('SELECT COUNT(*) AS count FROM registrations WHERE event_id = $1', [eventId]);
		const currentCount = parseInt(countResult.rows[0].count, 10);

		if (currentCount >= event.capacity) {
			await client.query('ROLLBACK');
			return res.status(400).json({ error: 'Event is full.' });
		}

		//  Check if user exists
		let userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
		let user = userResult.rows[0];

		if (!user) {
			userResult = await client.query(
				'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
				[name, email]
			);
			user = userResult.rows[0];
		}

		//  Check if already registered
		const regCheck = await client.query(
			'SELECT * FROM registrations WHERE user_id = $1 AND event_id = $2',
			[user.id, eventId]
		);

		if (regCheck.rows.length > 0) {
			await client.query('ROLLBACK');
			return res.status(400).json({ error: 'User already registered for this event.' });
		}

		//  Register user
		await client.query(
			'INSERT INTO registrations (user_id, event_id) VALUES ($1, $2)',
			[user.id, eventId]
		);

		//  Get updated registrations count
		const updatedCountResult = await client.query(
			'SELECT COUNT(*) AS count FROM registrations WHERE event_id = $1',
			[eventId]
		);
		const updatedCount = parseInt(updatedCountResult.rows[0].count, 10);

		await client.query('COMMIT');

		res.status(201).json({
			message: 'User successfully registered for event!',
			event: {
				...event,
				registrations_count: updatedCount
			},
			user
		});
	} catch (error) {
		await client.query('ROLLBACK');
		console.error(error);
		res.status(500).json({ error: 'Something went wrong while registering user.' });
	} finally {
		client.release();
	}
});


app.patch('/events/:id', async (req, res) => {
	const { id } = req.params
	const { title, description, location, date, capacity } = req.body
	const existing = await pool.query('SELECT * FROM events WHERE id = $1', [id]);
	if (existing.rows.length === 0) {
		return res.status(404).json({ error: 'Event not found' });
	}
	if (date && new Date(date) < new Date()) {
		return res.status(400).json({ error: 'Event date cannot be in the past' });
	}
	const result = await pool.query(
		`UPDATE events 
       SET 
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         location = COALESCE($3, location),
         date = COALESCE($4, date),
         capacity = COALESCE($5, capacity),
         updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
		[title, description, location, date, capacity, id]
	);
	res.json({
		message: 'Event updated successfully',
		event: result.rows[0],
	});
})


app.delete('/events/:id/register', async (req, res) => {
	const client = await pool.connect();
	try {
		const eventId = req.params.id;
		const { email } = req.body; // user is identified by email

		if (!email) {
			return res.status(400).json({ error: 'Email is required to cancel registration.' });
		}

		await client.query('BEGIN');

		//  Check if event exists
		const eventResult = await client.query('SELECT * FROM events WHERE id = $1', [eventId]);
		const event = eventResult.rows[0];
		if (!event) {
			await client.query('ROLLBACK');
			return res.status(404).json({ error: 'Event not found.' });
		}

		//  Check if user exists
		const userResult = await client.query('SELECT * FROM users WHERE email = $1', [email]);
		const user = userResult.rows[0];
		if (!user) {
			await client.query('ROLLBACK');
			return res.status(404).json({ error: 'User not found.' });
		}

		//  Check if registration exists
		const regResult = await client.query(
			'SELECT * FROM registrations WHERE user_id = $1 AND event_id = $2',
			[user.id, eventId]
		);

		if (regResult.rows.length === 0) {
			await client.query('ROLLBACK');
			return res.status(400).json({ error: 'User is not registered for this event.' });
		}

		//  Delete registration
		await client.query(
			'DELETE FROM registrations WHERE user_id = $1 AND event_id = $2',
			[user.id, eventId]
		);

		await client.query('COMMIT');

		res.status(200).json({
			message: 'Registration cancelled successfully.',
			event_id: eventId,
			user_id: user.id
		});

	} catch (error) {
		await client.query('ROLLBACK');
		console.error(error);
		res.status(500).json({ error: 'Something went wrong while cancelling registration.' });
	} finally {
		client.release();
	}
});


app.delete('/events/:id', async (req, res) => {
	const { id } = req.params
	const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [id]);
	res.status(200).json({ message: 'Event deleted successfully', event: result.rows[0] })
})


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
