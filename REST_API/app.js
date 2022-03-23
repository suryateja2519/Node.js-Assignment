const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const { response } = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const dbPath = path.join(__dirname, "rest_api_db.db");

const app = express();
app.use(express.json());
app.use(cors());

let db = null;
let port;

const initializeDbandServer = async () => {
	try {
		db = await open({ filename: dbPath, driver: sqlite3.Database });
		port = process.env.PORT || 9000;
		app.listen(port, () =>
			console.log(`server Running at http://localhost:${port}/`)
		);
	} catch (error) {
		console.log(`DB error: ${error.message}`);
		process.exit(1);
	}
};

initializeDbandServer();

const authentication = (req, res, next) => {
	let jwtToken;
	const authHeader = req.headers["authorization"];
	if (authHeader !== undefined) {
		jwtToken = authHeader.split(" ")[1];
		if (jwtToken === undefined) {
			response.status(401);
			response.send("Invalid JWT Token");
		} else {
			console.log(authHeader);

			jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
				if (error) {
					res.status(401);
					res.send("Invalid JWT Token");
				} else {
					req.username = payload.username;
					next();
				}
			});
		}
	}
};

app.get("/", async (req, res) => res.send("Server Running"));

app.post("/register", authentication, async (req, res) => {
	const { newAgency, newClient } = req.body;
	const {
		id,
		agency_name,
		address_1,
		address_2,
		state,
		city,
		agency_phone_number,
	} = newAgency;
	const { client_id, agency_id, name, email, phone_number, total_bill } =
		newClient;

	const searchAgencyQuery = `SELECT * FROM agency WHERE id = ${id};`;
	const isAgencyInDb = await db.get(searchAgencyQuery);
	const searchClientQuery = `SELECT * FROM client WHERE client_id = ${client_id};`;
	const isClientInDb = await db.get(searchClientQuery);

	if (isAgencyInDb !== undefined || isClientInDb !== undefined) {
		if (isAgencyInDb !== undefined && isClientInDb !== undefined) {
			res.status(400);
			res.send({ error: "Agency and client already exists" });
		} else if (isClientInDb !== undefined) {
			res.status(400);
			res.send({ error: "Client already exists" });
		} else {
			res.status(400);
			res.send({ error: "Agency already exists" });
		}
	} else {
		const addAgencyToDbQuery = `INSERT INTO agency (id,agency_name,address_1,address_2,state,city,agency_phone_number) VALUES (${id}, '${agency_name}', '${address_1}', '${address_2}','${state}','${city}',${agency_phone_number});`;
		const addClinetToDbQuery = `INSERT INTO client (client_id, agency_id, name, email, phone_number, total_bill) VALUES (${client_id}, ${agency_id},  '${name}', '${email}', ${phone_number}, ${total_bill});`;
		const queries = [addAgencyToDbQuery, addClinetToDbQuery];
		let success = [];
		let errors = [];
		for (query in queries) {
			try {
				await db.run(queries[query]);
				success.push({ success: query });
			} catch (error) {
				errors.push({ error: `${query} +${error}` });
			}
		}
		if (errors.length > 0) {
			res.status(400);
			res.json({ error: errors });
		} else {
			res.status(200);
			res.json({ success: "Agency and client added to DB" });
		}
	}
});

app.patch("/update-client", authentication, async (req, res) => {
	const { updateDetails } = req.body;
	const { client_id, agency_id, name, email, phone_number, total_bill } =
		updateDetails;
	const selectClientQuery = `SELECT * FROM client WHERE client_id =${client_id};`;
	const isClientInDb = await db.get(selectClientQuery);

	if (isClientInDb !== undefined) {
		const updateDetailsQuery = `UPDATE client SET client_id = ${client_id}, agency_id =${agency_id}, name='${name}', email='${email}', phone_number=${phone_number}, total_bill=${total_bill} WHERE client_id = ${client_id};`;
		try {
			const addData = await db.run(updateDetailsQuery);

			res.status(200);
			res.send("data updated");
		} catch (error) {
			res.status(400);
			res.json({ error });
		}
	}
});

app.get("/details", authentication, async (req, res) => {
	const getDetailsQuery = `SELECT agency.agency_name, client.name, client.total_bill FROM agency INNER JOIN client ON agency.id=client.client_id ORDER BY client.total_bill DESC`;
	try {
		const details = await db.all(getDetailsQuery);
		res.status(200);
		res.json({ data: details });
	} catch (error) {}
});

module.exports = app;
