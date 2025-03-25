import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Signup from "./pages/Signup";

// Function to check if user is logged in
const isAuthenticated = () => {
    return localStorage.getItem("token") ? true : false;
};

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/home" />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/login" element={<Login />} />
                <Route path="/home" element={<Home />} />
                
                {/* Protected Routes (Only accessible if authenticated) */}
                <Route path="/dashboard" element={isAuthenticated() ? <Dashboard /> : <Navigate to="/login" />} />
                <Route path="/profile" element={isAuthenticated() ? <Profile /> : <Navigate to="/login" />} />
            </Routes>
        </Router>
    );
};

export default App;
