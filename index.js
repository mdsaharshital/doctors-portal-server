const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

//----- middleware ----------
app.use(cors());
app.use(express.json());
//-----------------------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ux1hh.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
//
// verify jwt
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRETE, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Access denied" });
    }
    req.decoded = decoded;
    next();
  });
}
const run = async () => {
  try {
    await client.connect();
    const servicesCollection = client
      .db("doctors_portal")
      .collection("services");
    const bookingCollection = client.db("doctors_portal").collection("booking");
    const userCollection = client.db("doctors_portal").collection("user");
    const doctorCollection = client.db("doctors_portal").collection("doctors");
    console.log("db connected");

    // verify
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAcc = await userCollection.findOne({ email: requester });
      if (requesterAcc.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Access denied" });
      }
    };
    // our APIs

    // fetch all users from db
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send({ data: result });
    });

    // get admin role
    app.get("/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email: email });
      const isAdmin = result.role === "admin";
      res.send({ admin: isAdmin });
    });
    // set role of admin
    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // put method to update users
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRETE,
        { expiresIn: "1d" }
      );
      res.send({ success: true, message: "User updated", data: result, token });
    });
    //------------------
    // doctors  --------
    //------------------
    app.post("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send({ success: true, message: "Added sucessfully", data: result });
    });
    app.get("/doctor", verifyJWT, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });
    app.delete("/doctor/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email };
      const result = await doctorCollection.deleteOne(filter);
      if (result.deletedCount > 0) {
        res.send({
          success: true,
          message: "Deleted Successfully",
          data: result,
        });
      } else {
        res.send({
          success: false,
          message: "Couldn't delete",
          data: result,
        });
      }
    });
    // get my bookings
    app.get("/booking", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { patientEmail: email };
      const decodedEmail = req.decoded.email;
      if (email === decodedEmail) {
        const bookings = await bookingCollection.find(query).toArray();
        return res.send({ success: true, data: bookings });
      } else {
        return res.status(403).send({ message: "Access denied" });
      }
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
      const cursor = servicesCollection.find(query).project({ name: 1 });
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
