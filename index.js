const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

//----- middleware -----
app.use(cors());
app.use(express.json());
//----------------------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ux1hh.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const servicesCollection = client
      .db("doctors_portal")
      .collection("services");
    const bookingCollection = client.db("doctors_portal").collection("booking");
    console.log("db connected");
    // our APIs

    // get my bookings
    app.get("/booking", async (req, res) => {
      const email = req.query.email;
      const query = { patientEmail: email };
      const bookings = await bookingCollection.find(query).toArray();
      res.send({ success: true, data: bookings });
    });
    // post data to booking
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatmentId: booking.treatmentId,
        date: booking.date,
        patientEmail: booking.patientEmail,
      };
      const doExist = await bookingCollection.findOne(query);
      if (doExist) {
        return res.send({
          success: false,
          doExist,
        });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({
        success: true,
        message: `Appointment Booked successfully on ${booking.date} at ${booking.slot}`,
        result,
        doExist,
      });
    });
    // get all data
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send({ success: true, data: services });
    });
    // get all data from booking
    app.get("/booking", async (req, res) => {
      const query = {};
      const cursor = bookingCollection.find(query);
      const services = await cursor.toArray();
      res.send({ success: true, data: services });
    });
    // get all available data
    app.get("/available", async (req, res) => {
      const date = req.query?.date;
      const services = await servicesCollection.find({}).toArray();
      const filter = { date };
      const bookings = await bookingCollection.find(filter).toArray();
      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (book) => book.treatmentName === service.name
        );
        const bookedSlots = serviceBookings.map((book) => book.slot);
        const available = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        service.slots = available;
      });
      res.send({ success: true, data: services });
    });
  } finally {
    // console.log(error);
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("hellow doctors");
});
app.listen(port, () => {
  console.log("listening from", port);
});
