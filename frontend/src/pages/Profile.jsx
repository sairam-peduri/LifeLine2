import React from "react";
import { useNavigate } from "react-router-dom";
import "./profile.css";

const Profile = () => {
  const user = JSON.parse(localStorage.getItem("user")); // Get user from localStorage
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token"); // Remove JWT token
    localStorage.removeItem("user");  // Remove user info
    navigate("/login");  // Redirect to login page
  };

  return (
    <div className="profile-container">
      <h2>User Profile</h2>
      {user ? (
        <div>
          <p><strong>Name:</strong> {user.name}</p>
          <p><strong>Gender:</strong> {user.gender}</p>
          <p><strong>dob:</strong> {user.dob}</p>
          <p><strong>Email:</strong> {user.email}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <p>No user data found</p>
      )}
    </div>
  );
};

export default Profile;
