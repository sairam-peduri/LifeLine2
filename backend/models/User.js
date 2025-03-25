const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: String,
    gender:String,
    dob:Date,
    email: { type: String, unique: true },
    password: String,
});

module.exports = mongoose.model("User", userSchema);
