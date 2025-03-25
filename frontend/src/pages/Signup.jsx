import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/api";
import './signlogin.css';

const Signup = () => {
    const [user, setUser] = useState({ name: "",gender:"",dob:"", email: "", password: ""});

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            const res = await API.post("/auth/signup", user);
            alert(res.data.message);
        } catch (err) {
            alert(err.response.data.error);
        }
    };

    return (
        <div class="container d-flex justify-content-center align-items-center min-vh-100">
        <div class="form-box">
        <h2 class="text-center">Sign Up</h2>
        <form onSubmit={handleSignup}>
            <div className="mb-3">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-control" required placeholder="Name" onChange={(e) => setUser({ ...user, name: e.target.value })} />
            </div>
            <div className="mb-3">
                <label className="form-label">Date of Birth</label>
                <input type="date" className="form-control" required onChange={(e) => setUser({ ...user, dob: e.target.value })}/>
            </div>
            <div className="mb-3">
                <label className="form-label">Gender</label>
                <select className="form-control" required onChange={(e) => setUser({ ...user, gender: e.target.value })}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div className="mb-3">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" required placeholder="Email" onChange={(e) => setUser({ ...user, email: e.target.value })} />
            </div>
            <div className="mb-3">
                <label className="form-label">Password</label>
                <input type="password" className="form-control" required placeholder="Password" onChange={(e) => setUser({ ...user, password: e.target.value })} />
            </div>
            <button type="submit" className="btn btn-primary w-100">Sign Up</button>
            <p className="text-center mt-3">
            Already have an account? <Link to="/Login">Login</Link>
            </p>

        </form>
        </div>
</div>
    );
};

export default Signup;
