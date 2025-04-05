const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: String,
    gender: String,
    dob: Date,
    email: { type: String, unique: true },
    password: String,
    predictionHistory: [{
        disease: String,
        symptoms: [String], // Array of symptoms
        timestamp: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model("User", userSchema);