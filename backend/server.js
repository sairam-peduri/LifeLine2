const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const axios=require("axios");
const allowedOrigins = ["https://life-line2.vercel.app"];

dotenv.config();
const app = express();

app.use( cors({ origin: allowedOrigins, credentials: true }) );

// ✅ Middleware: Custom headers to support preflight and cookies
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://life-line2.vercel.app");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// ✅ Middleware: Allow preflight requests
app.options("*", cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json()); // Parse JSON requests

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ MongoDB Connection Error:", err));

app.get("/", (req, res) => {
    res.send("API is running...");
});

FLASK_API_URL = "https://lifeline2-1.onrender.com/api";

app.get("/api/get_symptoms", async (req, res) => {
    try {
        const flaskResponse = await axios.get(`${FLASK_API_URL}/get_symptoms`);
        res.json(flaskResponse.data);
    } catch (error) {
        console.error("❌ Error fetching symptoms from Flask:", error);
        res.status(500).json({ message: "Error fetching symptoms" });
    }
});

app.post("/api/predict", async (req, res) => {

  try {
    const { symptoms } = req.body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
        return res.status(400).json({ message: "Please provide symptoms." });
    }

    // Send request to Flask API
    const flaskResponse = await axios.post(`${FLASK_API_URL}/predict`, { symptoms });

    // Send prediction response to frontend
    res.json(flaskResponse.data);

} catch (error) {
    console.error("❌ Error communicating with Flask:", error);
    res.status(500).json({ message: "Error predicting disease" });
}
});
// Import Routes
app.use("/api/auth", require("./routes/auth"));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
