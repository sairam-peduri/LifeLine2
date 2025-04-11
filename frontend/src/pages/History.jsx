import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPredictionHistory } from "../api/api";
import Navbar from "../components/Navbar";
import "./History.css";

const History = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [history, setHistory] = useState([]);
    const [error, setError] = useState("");

    useEffect(() => {
        const storedUser = localStorage.getItem("user");
        if (!storedUser) {
            alert("Please log in first!");
            navigate("/login");
        } else {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            fetchHistory(parsedUser.name);
        }
    }, [navigate]);

    const fetchHistory = async (username) => {
        try {
            const historyData = await getPredictionHistory(username);
            setHistory(historyData.reverse()); // Newest first
        } catch (err) {
            setError("Failed to load history: " + err.message);
            console.error("History fetch error:", err);
        }
    };

    return (
        <div className="history-wrapper">
            {user ? (
                <>
                    <Navbar user={user} />
                    <div className="history-container">
                        <h2 className="history-header">Prediction History</h2>
                        {error && <p className="error">{error}</p>}
                        {history.length > 0 ? (
                            <>
                                <ul className="history-list">
                                    {history.map((entry, index) => (
                                        <li key={index} className="history-item">
                                            <strong>{entry.disease}</strong><br />
                                            Symptoms: {entry.symptoms.join(", ")}<br />
                                            {/* <span className="timestamp">
                                                Predicted on: {new Date(entry.timestamp).toLocaleString()}
                                            </span> */}
                                        </li>
                                    ))}
                                </ul>
                            </>
                        ) : (
                            <p>No prediction history available.</p>
                        )}
                    </div>
                </>
            ) : (
                <p>Loading...</p>
            )}
        </div>
    );
};

export default History;
