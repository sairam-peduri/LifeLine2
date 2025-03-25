import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/api";
import './signlogin.css';

const Login = () => {
    const [credentials, setCredentials] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const navigate = useNavigate();


    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const res = await API.post("/auth/login", credentials);
            localStorage.setItem("token", res.data.token);
            localStorage.setItem("user", JSON.stringify(res.data.user)); // Store user data
            //alert("Login successful");
            navigate("/dashboard");
        } catch (err) {
            alert(err.response?.data?.error || "Login failed! Please try again.");
        }
    };

    return (
<div className="container d-flex justify-content-center align-items-center min-vh-100">
    <div className="form-box">
        <h2 className="text-center">Login</h2>
        <form onSubmit={handleLogin}>
            <div className="mb-3">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" placeholder="Email" onChange={(e) => setCredentials({ ...credentials, email: e.target.value })} required/>
            </div>
            <div className="mb-3">
                <label className="form-label">Password</label>
                <input type="password" className="form-control" placeholder="Password" onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} required/>
            </div>
            <button type="submit" className="btn btn-success w-100">Login</button>
            <p className="text-center mt-3">Don't have an account? <Link to="/signup">Signup</Link></p>
        </form>
    </div>
</div>
    )
};

export default Login;
